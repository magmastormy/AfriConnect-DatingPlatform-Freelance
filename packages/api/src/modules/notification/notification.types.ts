import { NotificationChannel, UserRole } from '@africonnect/shared';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  /** Optional in-app destination; the bell renders it as a CTA when present. */
  link?: string;
  data?: Record<string, unknown>;
}

export interface BulkNotificationInput {
  type: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  /** Optional role segment; omit to target all active members. */
  role?: UserRole;
  /** Optional in-app destination; the bell renders it as a CTA when present. */
  link?: string;
  data?: Record<string, unknown>;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  isRead: boolean;
  createdAt: Date;
  link?: string;
}
