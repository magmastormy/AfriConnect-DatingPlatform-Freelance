import { PrismaClient, Conversation, Message } from '@prisma/client';
import { NotFoundError, ConflictError, InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import { rawPrisma, RLS_ENABLED } from '@config/prisma';

export interface IChatRepository {
  findOrCreateConversation(a: string, b: string): Promise<Conversation>;
  findConversation(id: string): Promise<Conversation | null>;
  listConversations(userId: string): Promise<Conversation[]>;
  /**
   * Conversations for the sidebar, enriched with the *other* participant's
   * display name, photo, verified/premium flags, the last message preview, and
   * the caller's unread count. The client renders this directly as a
   * Messenger-style thread list.
   */
  listConversationsWithDetails(
    userId: string,
  ): Promise<
    (Conversation & {
      other: {
        userId: string;
        displayName: string | null;
        photo: string | null;
        verified: boolean;
        isPremium: boolean;
      } | null;
      lastMessage: {
        id: string;
        senderId: string;
        content: string;
        imageUrl: string | null;
        isDeleted: boolean;
        recalledAt: Date | null;
        createdAt: Date;
      } | null;
      unread: number;
    })[]
  >;
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
  /** Counts unread messages (sent by others, not yet read) across every
   *  conversation the caller participates in. */
  unreadCountAcross(userId: string): Promise<number>;
  /** The other participant's public profile — used to voice the AI reply. */
  getMemberProfile(
    userId: string,
  ): Promise<{
    displayName: string | null;
    firstName: string;
    lastName: string;
    city: string;
    headline: string | null;
    profession: string | null;
    employer: string | null;
    bio: string | null;
    interests: string[];
    gender: string;
    dateOfBirth: Date | null;
  } | null>;
  /** Recent messages for a conversation, ordered oldest→newest (capped). */
  getRecentMessages(conversationId: string, take: number): Promise<Message[]>;
  /** Whether a user id resolves to a real account (for the relaxed gate). */
  userExists(userId: string): Promise<boolean>;
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

  async listConversationsWithDetails(userId: string) {
    const convs = await this.prisma.conversation.findMany({
      where: { OR: [{ participant1Id: userId }, { participant2Id: userId }], isActive: true },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participant1: { include: { profile: true, subscriptions: true } },
        participant2: { include: { profile: true, subscriptions: true } },
        messages: {
          where: { senderId: { not: userId }, status: { not: 'read' } },
          select: { id: true },
        },
      },
    });
    return Promise.all(
      convs.map(async (conv) => {
        const otherId =
          conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;
        const otherUser =
          conv.participant1Id === userId ? conv.participant2 : conv.participant1;
        const otherProfile = otherUser.profile;
        const photos = Array.isArray(otherProfile?.photos)
          ? (otherProfile!.photos as { url: string }[]).map((p) => p.url).filter(Boolean)
          : [];
        const verified = Boolean(otherUser.status === 'active');
        const isPremium = Boolean(
          otherUser.subscriptions?.plan === 'premium' ||
            otherUser.subscriptions?.plan === 'platinum',
        );
        // lastMessageId is a scalar FK; resolve the row separately (no relation).
        const lm = conv.lastMessageId
          ? await this.prisma.message.findUnique({ where: { id: conv.lastMessageId } })
          : null;
        return {
          ...conv,
          other: otherProfile
            ? {
                userId: otherId,
                displayName: otherProfile.displayName ?? null,
                photo: photos[0] ?? null,
                verified,
                isPremium,
              }
            : null,
          lastMessage: lm
            ? {
                id: lm.id,
                senderId: lm.senderId,
                content: lm.content,
                imageUrl: lm.imageUrl ?? null,
                isDeleted: lm.isDeleted,
                recalledAt: lm.recalledAt,
                createdAt: lm.createdAt,
              }
            : null,
          unread: conv.messages.length,
        };
      }),
    );
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
      // Use the raw (un-extended) client so this internal transaction does not
      // nest inside the RLS extension's per-operation transaction wrapper.
      // When RLS is forced on, set bypass_rls for this trusted write: the
      // service layer has already verified `senderId` is a conversation
      // participant, so the WITH CHECK policy (senderId = current_user_id)
      // would otherwise reject the insert because no GUC is set here.
      return await rawPrisma.$transaction(async (tx) => {
        if (RLS_ENABLED) {
          await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
        }
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

  async unreadCountAcross(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        senderId: { not: userId },
        status: { not: 'read' },
        conversation: {
          OR: [{ participant1Id: userId }, { participant2Id: userId }],
          isActive: true,
        },
      },
    });
  }

  async getMemberProfile(userId: string) {
    return this.prisma.profile.findUnique({
      where: { userId },
      select: {
        displayName: true,
        firstName: true,
        lastName: true,
        city: true,
        headline: true,
        profession: true,
        employer: true,
        bio: true,
        interests: true,
        gender: true,
        dateOfBirth: true,
      },
    });
  }

  async getRecentMessages(conversationId: string, take: number): Promise<Message[]> {
    const recent = await this.prisma.message.findMany({
      where: { conversationId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take,
    });
    // Return chronological (oldest first) so the LLM sees a natural transcript.
    return recent.reverse();
  }

  async userExists(userId: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return Boolean(found);
  }
}
