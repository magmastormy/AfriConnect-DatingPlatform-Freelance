import { IChatRepository } from './chat.repository';
import { RealtimeHub } from './chat.ws';
import { SendMessageInput, EditMessageInput } from './chat.types';
import { ValidationError, NotFoundError, ConflictError } from '@africonnect/shared';

export const MESSAGE_RECALL_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export interface IChatService {
  listConversations(userId: string): Promise<unknown[]>;
  getMessages(userId: string, conversationId: string): Promise<unknown[]>;
  send(userId: string, conversationId: string, input: SendMessageInput): Promise<unknown>;
  edit(userId: string, messageId: string, input: EditMessageInput): Promise<unknown>;
  remove(userId: string, messageId: string): Promise<{ deleted: true }>;
  recall(userId: string, messageId: string): Promise<{ recalled: true }>;
  markRead(userId: string, conversationId: string): Promise<void>;
}

export class ChatService implements IChatService {
  constructor(
    private readonly repo: IChatRepository,
    private readonly realtime?: RealtimeHub,
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

  async markRead(userId: string, conversationId: string): Promise<void> {
    await this.repo.markRead(conversationId, userId);
  }
}
