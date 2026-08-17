import { Prisma, PrismaClient, Notification } from '@prisma/client';
import { NotFoundError, InternalError, UserRole } from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import { Pagination } from '@africonnect/shared';

export interface INotificationRepository {
  create(data: Record<string, unknown>): Promise<Notification>;
  listForUser(userId: string, pagination: Pagination): Promise<Notification[]>;
  markRead(id: string, userId: string): Promise<void>;
  unreadCount(userId: string): Promise<number>;
  markAllRead(userId: string): Promise<void>;
  /** Members eligible for an admin broadcast (active, non-banned accounts). */
  getSegment(role?: string): Promise<Array<{ userId: string }>>;
  /** All active users holding any of the given roles (for scoped alerts). */
  getUsersByRoles(roles: string[]): Promise<Array<{ userId: string }>>;
  /** Insert one notification row per recipient in a single transaction. */
  bulkCreate(rows: Array<Record<string, unknown>>): Promise<number>;
}

export class NotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Record<string, unknown>): Promise<Notification> {
    try {
      return await this.prisma.notification.create({
        data: data as Prisma.NotificationUncheckedCreateInput,
      });
    } catch (error) {
      logger.error({ error }, 'NotificationRepository: create failed');
      throw new InternalError('Could not create notification');
    }
  }

  async listForUser(userId: string, pagination: Pagination): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    });
  }

  async markRead(id: string, userId: string): Promise<void> {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) {
      throw new NotFoundError('Notification not found', { id });
    }
    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getSegment(role?: string): Promise<Array<{ userId: string }>> {
    const users = await this.prisma.user.findMany({
      where: role
        ? { role: role as Prisma.UserWhereInput['role'], status: 'active' }
        : { status: 'active' },
      select: { id: true },
    });
    return users.map((u) => ({ userId: u.id }));
  }

  async getUsersByRoles(roles: string[]): Promise<Array<{ userId: string }>> {
    if (!roles.length) return [];
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: roles.map((r) => r as UserRole) },
        status: 'active',
      },
      select: { id: true },
    });
    return users.map((u) => ({ userId: u.id }));
  }

  async bulkCreate(rows: Array<Record<string, unknown>>): Promise<number> {
    if (!rows.length) return 0;
    try {
      const result = await this.prisma.notification.createMany({
        data: rows as Prisma.NotificationCreateManyInput[],
      });
      return result.count;
    } catch (error) {
      logger.error({ error, count: rows.length }, 'NotificationRepository: bulkCreate failed');
      throw new InternalError('Could not dispatch notifications');
    }
  }
}
