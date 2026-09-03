import { IChatRepository } from './chat.repository';
import { RealtimeHub } from './chat.ws';
import { SendMessageInput, EditMessageInput } from './chat.types';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  logger,
  IMediaStorage,
  toBrowserMediaUrl,
} from '@africonnect/shared';
import type { IMatchService } from '@modules/match';
import { ILLMProvider, LLMMessage } from '../../lib/llm';

export const MESSAGE_RECALL_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export interface IChatService {
  listConversations(userId: string): Promise<unknown[]>;
  /** Conversations enriched for the sidebar (other participant + last message + unread). */
  listConversationsDetailed(userId: string): Promise<unknown[]>;
  getMessages(userId: string, conversationId: string): Promise<unknown[]>;
  send(userId: string, conversationId: string, input: SendMessageInput): Promise<unknown>;
  edit(userId: string, messageId: string, input: EditMessageInput): Promise<unknown>;
  remove(userId: string, messageId: string): Promise<{ deleted: true }>;
  recall(userId: string, messageId: string): Promise<{ recalled: true }>;
  markRead(userId: string, conversationId: string): Promise<void>;
  /** Lazily open (or fetch) a 1:1 conversation. Guarded by an isMutual check so a
   *  member can only message someone they have matched with. */
  getOrCreateConversation(userId: string, targetId: string): Promise<{ id: string }>;
  /** Total unread messages across all of the caller's conversations. */
  unreadCount(userId: string): Promise<number>;
}

export class ChatService implements IChatService {
  constructor(
    private readonly repo: IChatRepository,
    private readonly realtime?: RealtimeHub,
    private readonly match?: IMatchService,
    private readonly media?: IMediaStorage,
    private readonly opts: { llm?: ILLMProvider; aiChatEnabled?: boolean } = {},
  ) {}

  /**
   * Signs a message row's imageUrl for browser/realtime delivery. The row in
   * the DB keeps the raw storage URL (re-signing on every read keeps links
   * valid); only the copy we return/broadcast carries the presigned URL.
   */
  private async withSignedImage<T extends { imageUrl?: string | null }>(message: T): Promise<T> {
    if (!this.media || !message.imageUrl) return message;
    const imageUrl = await toBrowserMediaUrl(message.imageUrl, this.media);
    return imageUrl ? { ...message, imageUrl } : message;
  }

  private get aiChatEnabled(): boolean {
    return this.opts.aiChatEnabled ?? false;
  }

  private get llm(): ILLMProvider | undefined {
    return this.opts.llm;
  }

  async listConversations(userId: string): Promise<unknown[]> {
    return this.repo.listConversations(userId);
  }

  async listConversationsDetailed(userId: string): Promise<unknown[]> {
    const list = await this.repo.listConversationsWithDetails(userId);
    return Promise.all(
      list.map(async (row) => {
        const conv = row as {
          other?: { photo?: string | null } | null;
          lastMessage?: { imageUrl?: string | null } | null;
        };
        if (!this.media || (!conv.other?.photo && !conv.lastMessage?.imageUrl)) return row;
        const [photo, lastMessage] = await Promise.all([
          toBrowserMediaUrl(conv.other?.photo ?? null, this.media),
          conv.lastMessage
            ? this.withSignedImage(conv.lastMessage).then((m) => m as unknown)
            : Promise.resolve(conv.lastMessage),
        ]);
        return {
          ...(row as object),
          other: conv.other ? { ...conv.other, photo } : conv.other,
          lastMessage,
        };
      }),
    );
  }

  async getMessages(userId: string, conversationId: string): Promise<unknown[]> {
    const conv = await this.repo.findConversation(conversationId);
    if (!conv) throw new NotFoundError('Conversation not found', { conversationId });
    if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
      throw new ConflictError('You are not a participant in this conversation');
    }
    const messages = await this.repo.getMessages(conversationId, { skip: 0, take: 100 });
    return Promise.all(messages.map((m) => this.withSignedImage(m)));
  }

  async send(userId: string, conversationId: string, input: SendMessageInput): Promise<unknown> {
    const body = (input.content ?? '').trim();
    if (!body && !input.imageUrl) throw new ValidationError('Empty message');
    const message = await this.repo.sendMessage(conversationId, userId, body, input.imageUrl);
    // The broadcast + response carry a presigned copy; the DB row keeps raw URL.
    const outbound = await this.withSignedImage(message);
    // Realtime: push to both participants if either is connected.
    void this.realtime?.broadcastMessage(conversationId, outbound);
    // Fire-and-forget AI auto-reply (the other participant's voice). Kept off the
    // request path so Groq latency never blocks the 201; the reply arrives via
    // the same realtime channel the client already listens on.
    if (this.aiChatEnabled && this.llm && body) {
      void this.generateAiReply(conversationId, userId).catch((err) =>
        logger.error({ err, conversationId }, 'ChatService: AI reply generation crashed'),
      );
    }
    return outbound;
  }

  async edit(userId: string, messageId: string, input: EditMessageInput): Promise<unknown> {
    const msg = await this.repo.findMessage(messageId);
    if (!msg) throw new NotFoundError('Message not found', { messageId });
    if (msg.senderId !== userId) throw new ConflictError('You can only edit your own messages');
    if (msg.isDeleted) throw new ValidationError('Cannot edit a deleted message');
    if (msg.recalledAt) throw new ValidationError('Cannot edit a recalled message');
    const body = input.content.trim();
    if (!body) throw new ValidationError('Message cannot be empty');
    const message = await this.repo.editMessage(messageId, body);
    void this.realtime?.broadcastMessage(msg.conversationId, message);
    return message;
  }

  async remove(userId: string, messageId: string): Promise<{ deleted: true }> {
    const msg = await this.repo.findMessage(messageId);
    if (!msg) throw new NotFoundError('Message not found', { messageId });
    if (msg.senderId !== userId) throw new ConflictError('You can only delete your own messages');
    await this.repo.softDeleteMessage(messageId);
    void this.realtime?.broadcastMessage(msg.conversationId, {
      ...msg,
      isDeleted: true,
      content: '',
    });
    return { deleted: true };
  }

  async recall(userId: string, messageId: string): Promise<{ recalled: true }> {
    const msg = await this.repo.findMessage(messageId);
    if (!msg) throw new NotFoundError('Message not found', { messageId });
    if (msg.senderId !== userId) throw new ConflictError('You can only recall your own messages');
    if (msg.recalledAt) throw new ValidationError('Message already recalled');
    const within = Date.now() - new Date(msg.createdAt).getTime() <= MESSAGE_RECALL_WINDOW_MS;
    if (!within) throw new ValidationError('Recall window has expired');
    await this.repo.recallMessage(messageId);
    void this.realtime?.broadcastMessage(msg.conversationId, {
      ...msg,
      recalledAt: new Date(),
      isDeleted: true,
      content: '',
    });
    return { recalled: true };
  }

  async getOrCreateConversation(userId: string, targetId: string): Promise<{ id: string }> {
    if (!targetId || targetId === userId) {
      throw new ValidationError('Invalid conversation target');
    }
    // Conversation creation is normally gated on a mutual match: a member may
    // only open a thread with someone they have matched with. The match module
    // is the source of truth for that relationship (isMutual). In AI-chat mode
    // (prototype) that gate is relaxed so messaging stays functional before a
    // real match exists — but we still verify the target is a real account.
    const mutual = this.match ? await this.match.isMutual(userId, targetId) : false;
    if (!mutual) {
      if (!this.aiChatEnabled) {
        throw new ConflictError('You can only message members you have matched with');
      }
      const exists = await this.repo.userExists(targetId);
      if (!exists) throw new NotFoundError('Member not found', { targetId });
    }
    const conv = await this.repo.findOrCreateConversation(userId, targetId);
    return { id: conv.id };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.unreadCountAcross(userId);
  }

  // ── AI auto-reply (prototype messaging stand-in) ──────────────────────────
  /**
   * Generates a reply in the OTHER participant's voice using their profile as the
   * persona, then persists + broadcasts it as a normal message. Never throws:
   * on any failure we fall back to a canned, on-character line so the thread
   * always has a response. The reply is attributed to the other participant
   * (a real Conversation member) so it satisfies the repo's participant check.
   */
  private async generateAiReply(conversationId: string, userSenderId: string): Promise<void> {
    if (!this.llm) return;
    const conv = await this.repo.findConversation(conversationId);
    if (!conv) return;
    const otherId =
      conv.participant1Id === userSenderId ? conv.participant2Id : conv.participant1Id;

    const profile = await this.repo.getMemberProfile(otherId);
    const history = await this.repo.getRecentMessages(conversationId, 12);
    const messages = this.buildAiMessages(profile, history, userSenderId);

    let content: string;
    try {
      const res = await this.llm.complete(messages, { maxTokens: 280, temperature: 0.85 });
      content = (res.content || '').trim() || this.cannedAiReply();
    } catch (err) {
      logger.error({ err, conversationId }, 'ChatService: AI complete failed; canned fallback');
      content = this.cannedAiReply();
    }

    const aiMessage = await this.repo.sendMessage(conversationId, otherId, content, null);
    void this.realtime?.broadcastMessage(conversationId, aiMessage);
  }

  /** Builds the LLM transcript: a persona system prompt + the recent thread. */
  private buildAiMessages(
    profile: Awaited<ReturnType<IChatRepository['getMemberProfile']>>,
    history: { senderId: string; content: string }[],
    userSenderId: string,
  ): LLMMessage[] {
    const name =
      profile?.displayName ||
      `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() ||
      'a member';
    const age = profile?.dateOfBirth ? this.ageFromDob(profile.dateOfBirth) : null;
    const profession = profile?.profession || 'professional';
    const sys = [
      `You are ${name},${age ? ` a ${age}-year-old ${profession}` : ` a ${profession}`} based in ${profile?.city || 'South Africa'}.`,
      profile?.headline ? ` Tagline: ${profile.headline}.` : '',
      profile?.bio ? ` About you: ${profile.bio}` : '',
      profile?.interests?.length ? ` Your interests: ${profile.interests.join(', ')}.` : '',
      ' You are chatting on AfriConnect, a dating app for African professionals.',
      ` Stay fully in character as ${name}. Be warm, curious and concise (1-3 sentences).`,
      ' Reply naturally as if getting to know someone. Never say you are an AI or a bot.',
    ].join('');

    const messages: LLMMessage[] = [{ role: 'system', content: sys }];
    for (const m of history) {
      if (!m.content) continue;
      messages.push({
        role: m.senderId === userSenderId ? 'user' : 'assistant',
        content: m.content,
      });
    }
    return messages;
  }

  private ageFromDob(dob: Date): number {
    const diff = Date.now() - dob.getTime();
    return Math.max(18, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
  }

  private cannedAiReply(): string {
    const lines = [
      'Hey! Thanks for reaching out 😊 Tell me a bit about yourself.',
      'Hi! I’d love to get to know you better — what do you enjoy doing on weekends?',
      'Hello! You seem lovely. What made you say hi today?',
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    const conv = await this.repo.findConversation(conversationId);
    if (!conv) throw new NotFoundError('Conversation not found', { conversationId });
    if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
      throw new ConflictError('You are not a participant in this conversation');
    }
    await this.repo.markRead(conversationId, userId);
  }
}
