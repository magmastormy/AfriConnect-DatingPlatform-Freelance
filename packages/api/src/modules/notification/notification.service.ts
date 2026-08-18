import { INotificationRepository } from './notification.repository';
import {
  CreateNotificationInput,
  NotificationView,
  BulkNotificationInput,
} from './notification.types';
import { logger, asEnum, AdminScope, SCOPE_ROLES } from '@africonnect/shared';
import { Pagination, toPagination } from '@africonnect/shared';

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
    logger.info({ type: input.type, channel: input.channel }, 'Notification dispatched (console)');
    return this.toView(n);
  }

  async list(userId: string, page?: number, limit?: number): Promise<NotificationView[]> {
    const pagination: Pagination = toPagination(page, limit);
    const list = await this.repo.listForUser(userId, pagination);
    return list.map((n) => this.toView(n));
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.repo.markRead(id, userId);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.unreadCount(userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
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
