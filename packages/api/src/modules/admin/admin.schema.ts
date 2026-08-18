import { z } from 'zod';
import {
  UserRole,
  UserStatus,
  ApplicationStatus,
  AdminScope,
  SubscriptionPlan,
  EventStatus,
  NotificationChannel,
} from '@africonnect/shared';

export const listQuerySchema = z.object({
  status: z.nativeEnum(ApplicationStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
  search: z.string().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const memberQuerySchema = z.object({
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
  search: z.string().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const reviewApplicationSchema = z.object({
  status: z.union([
    z.literal(ApplicationStatus.Approved),
    z.literal(ApplicationStatus.Rejected),
    z.literal(ApplicationStatus.OnHold),
    z.literal(ApplicationStatus.UnderReview),
  ]),
  adminNotes: z.string().max(2000).optional(),
});

export const assignRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const memberActionSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const subscriptionCancelSchema = z.object({
  atPeriodEnd: z.boolean().default(true),
  reason: z.string().max(500).optional(),
});

export const grantSubscriptionSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
  months: z.number().int().min(1).max(36).default(1),
  reason: z.string().max(500).optional(),
});

export const eventModerationSchema = z.object({
  status: z.nativeEnum(EventStatus).optional(),
  featured: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

export const bulkNotifySchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  channel: z.nativeEnum(NotificationChannel),
  role: z.nativeEnum(UserRole).optional(),
  link: z.string().max(500).optional(),
  data: z.record(z.unknown()).optional(),
});

export const userIdParamSchema = z.object({ id: z.string().min(1) });
export const eventIdParamSchema = z.object({ id: z.string().min(1) });
export const scopeParamSchema = z.object({ scope: z.nativeEnum(AdminScope) });
