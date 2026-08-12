import { PrismaClient, Conversation, Message } from '@prisma/client';
import { NotFoundError, ConflictError, InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';

export interface IChatRepository {
  findOrCreateConversation(a: string, b: string): Promise<Conversation>;
  findConversation(id: string): Promise<Conversation | null>;
  listConversations(userId: string): Promise<Conversation[]>;
  getMessages(
    conversationId: string,
    pagination: { skip: number; take: number },
  ): Promise<Message[]>;
  findMessage(id: string): Promise<Message | null>;
  sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    imageUrl?: string | null,
  ): Promise<Message>;
  editMessage(id: string, content: string): Promise<Message>;
  softDeleteMessage(id: string): Promise<void>;
  recallMessage(id: string): Promise<void>;
  markRead(conversationId: string, userId: string): Promise<void>;
}

export class ChatRepository implements IChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOrCreateConversation(a: string, b: string): Promise<Conversation> {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: a, participant2Id: b },
          { participant1Id: b, participant2Id: a },
        ],
      },
    });
    if (existing) return existing;
    try {
      return await this.prisma.conversation.create({
        data: { participant1Id: a, participant2Id: b },
      });
    } catch (error) {
      logger.error({ error, a, b }, 'ChatRepository: create conversation failed');
      throw new InternalError('Could not open conversation');
    }
  }

  async findConversation(id: string): Promise<Conversation | null> {
    return this.prisma.conversation.findUnique({ where: { id } });
  }

  async listConversations(userId: string): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: { OR: [{ participant1Id: userId }, { participant2Id: userId }], isActive: true },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getMessages(
    conversationId: string,
    { skip, take }: { skip: number; take: number },
  ): Promise<Message[]> {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundError('Conversation not found', { conversationId });
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });
  }

  async findMessage(id: string): Promise<Message | null> {
    return this.prisma.message.findUnique({ where: { id } });
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    imageUrl?: string | null,
  ): Promise<Message> {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundError('Conversation not found', { conversationId });
    if (conv.participant1Id !== senderId && conv.participant2Id !== senderId) {
      throw new ConflictError('You are not a participant in this conversation');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: { conversationId, senderId, content, imageUrl: imageUrl ?? null, status: 'sent' },
        });
        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageId: message.id, lastMessageAt: message.createdAt },
        });
        return message;
      });
    } catch (error) {
      logger.error({ error, conversationId }, 'ChatRepository: sendMessage failed');
      throw new InternalError('Could not send message');
    }
  }

  async editMessage(id: string, content: string): Promise<Message> {
    try {
      return await this.prisma.message.update({
        where: { id },
        data: { content, isEdited: true, editedAt: new Date() },
      });
    } catch (error) {
      logger.error({ error, id }, 'ChatRepository: editMessage failed');
      throw new InternalError('Could not edit message');
    }
  }

  async softDeleteMessage(id: string): Promise<void> {
    try {
      await this.prisma.message.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), content: '' },
      });
    } catch (error) {
      logger.error({ error, id }, 'ChatRepository: softDeleteMessage failed');
      throw new InternalError('Could not delete message');
    }
  }

  async recallMessage(id: string): Promise<void> {
    try {
      await this.prisma.message.update({
        where: { id },
        data: { recalledAt: new Date(), isDeleted: true, deletedAt: new Date(), content: '' },
      });
    } catch (error) {
      logger.error({ error, id }, 'ChatRepository: recallMessage failed');
      throw new InternalError('Could not recall message');
    }
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, status: { not: 'read' } },
      data: { status: 'read' },
    });
  }
}
