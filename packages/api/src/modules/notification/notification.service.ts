import { INotificationRepository } from './notification.repository';
import {
  CreateNotificationInput,
  NotificationView,
  BulkNotificationInput,
} from './notification.types';
import { logger, asEnum, AdminScope, SCOPE_ROLES } from '@africonnect/shared';
import { Pagination, toPagination } from '@africonnect/shared';
import { redisGetJson, redisSetJson, redisDel } from '@config/redis';

export interface INotificationService {
  create(input: CreateNotificationInput): Promise<NotificationView>;
  list(userId: string, page?: number, limit?: number): Promise<NotificationView[]>;
  markRead(id: string, userId: string): Promise<void>;
  unreadCount(userId: string): Promise<number>;
  markAllRead(userId: string): Promise<void>;
  /** Admin broadcast: fans out a notification to every active segmented member. */
  bulk(input: BulkNotificationInput): Promise<{ queued: number }>;
  /**
   * Fan out an in-app alert to every active admin holding one of the given
   * scopes (used for vetting/payment events that need human intervention).
   */
  notifyAdmins(input: CreateNotificationInput, scopes?: AdminScope[]): Promise<number>;
}

export class NotificationService implements INotificationService {
  constructor(private readonly repo: INotificationRepository) {}

  async create(input: CreateNotificationInput): Promise<NotificationView> {
    const n = await this.repo.create({ ...input, sentAt: new Date() });
    // Invalidate unread count cache for recipient
    await redisDel(`notify:unread:${input.userId}`).catch(() => {});
    logger.info({ type: input.type, channel: input.channel }, 'Notification dispatched (console)');
    return this.toView(n);
  }

  async list(userId: string, page?: number, limit?: number): Promise<NotificationView[]> {
    const pagination: Pagination = toPagination(page, limit);
    // Only first page is hot — cache it briefly (polling clients hit page 1 repeatedly), skip in tests for hermetics
    if (process.env.NODE_ENV !== 'test' && pagination.page === 1 && pagination.limit <= 20) {
      const cacheKey = `notify:list:${userId}:${pagination.limit}`;
      const cached = await redisGetJson<NotificationView[]>(cacheKey).catch(() => null);
      if (cached) return cached;
      const list = await this.repo.listForUser(userId, pagination);
      const views = list.map((n) => this.toView(n));
      await redisSetJson(cacheKey, views, 5).catch(() => {});
      return views;
    }
    const list = await this.repo.listForUser(userId, pagination);
    return list.map((n) => this.toView(n));
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.repo.markRead(id, userId);
    await redisDel(`notify:unread:${userId}`).catch(() => {});
    await redisDel(`notify:list:${userId}:20`).catch(() => {});
  }

  async unreadCount(userId: string): Promise<number> {
    if (process.env.NODE_ENV === 'test') return this.repo.unreadCount(userId);
    const cacheKey = `notify:unread:${userId}`;
    const cached = await redisGetJson<number>(cacheKey).catch(() => null);
    if (cached !== null && cached !== undefined) return cached as number;
    const count = await this.repo.unreadCount(userId);
    await redisSetJson(cacheKey, count, 5).catch(() => {});
    return count;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
    await redisDel(`notify:unread:${userId}`).catch(() => {});
    await redisDel(`notify:list:${userId}:20`).catch(() => {});
  }

  async bulk(input: BulkNotificationInput): Promise<{ queued: number }> {
    const segment = await this.repo.getSegment(input.role);
    if (!segment.length) {
      logger.info({ type: input.type }, 'Bulk broadcast: no eligible recipients');
      return { queued: 0 };
    }
    const now = new Date();
    const rows = segment.map((member) => ({
      userId: member.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      channel: input.channel,
      data: input.data ?? null,
      isRead: false,
      sentAt: now,
    }));
    const queued = await this.repo.bulkCreate(rows);
    logger.info({ type: input.type, queued }, 'Bulk notification broadcast dispatched');
    return { queued };
  }

  async notifyAdmins(input: CreateNotificationInput, scopes?: AdminScope[]): Promise<number> {
    const targets = scopes && scopes.length ? scopes : (Object.values(AdminScope) as AdminScope[]);
    const roles = Array.from(new Set(targets.flatMap((s) => SCOPE_ROLES[s]))).map((r) =>
      r.toString(),
    );
    const users = await this.repo.getUsersByRoles(roles);
    if (!users.length) return 0;
    const now = new Date();
    const rows = users.map((u) => ({
      userId: u.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      channel: input.channel,
      data: input.data ?? null,
      isRead: false,
      sentAt: now,
    }));
    const queued = await this.repo.bulkCreate(rows);
    logger.info({ type: input.type, queued, scopes: targets }, 'Scoped admin alert dispatched');
    return queued;
  }

  private toView(n: {
    id: string;
    type: string;
    title: string;
    body: string;
    channel: unknown;
    isRead: boolean;
    createdAt: Date;
    link?: string | null;
  }): NotificationView {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      channel: asEnum<NotificationView['channel']>(n.channel),
      isRead: n.isRead,
      createdAt: n.createdAt,
      link: n.link ?? undefined,
    };
  }
}
