import { IChatRepository } from './chat.repository';
import { RealtimeHub } from './chat.ws';
import { SendMessageInput, EditMessageInput } from './chat.types';
import { ValidationError, NotFoundError, ConflictError } from '@africonnect/shared';
import type { IMatchService } from '@modules/match';

export const MESSAGE_RECALL_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export interface IChatService {
  listConversations(userId: string): Promise<unknown[]>;
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
  ) {}

  async listConversations(userId: string): Promise<unknown[]> {
    return this.repo.listConversations(userId);
  }

  async getMessages(userId: string, conversationId: string): Promise<unknown[]> {
    const conv = await this.repo.findConversation(conversationId);
    if (!conv) throw new NotFoundError('Conversation not found', { conversationId });
    if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
      throw new ConflictError('You are not a participant in this conversation');
    }
    return this.repo.getMessages(conversationId, { skip: 0, take: 100 });
  }

  async send(userId: string, conversationId: string, input: SendMessageInput): Promise<unknown> {
    const body = (input.content ?? '').trim();
    if (!body && !input.imageUrl) throw new ValidationError('Empty message');
    const message = await this.repo.sendMessage(conversationId, userId, body, input.imageUrl);
    // Realtime: push to both participants if either is connected.
    void this.realtime?.broadcastMessage(conversationId, message);
    return message;
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
    // Conversation creation is a privileged action: a member may only open a
    // thread with someone they have mutually matched with. The match module is
    // the source of truth for that relationship (isMutual).
    if (this.match && !(await this.match.isMutual(userId, targetId))) {
      throw new ConflictError('You can only message members you have matched with');
    }
    const conv = await this.repo.findOrCreateConversation(userId, targetId);
    return { id: conv.id };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.unreadCountAcross(userId);
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
