import { z } from 'zod';
import { NotificationChannel } from '@africonnect/shared';

export const createNotificationSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  channel: z.nativeEnum(NotificationChannel),
  link: z.string().max(500).optional(),
  data: z.record(z.unknown()).optional(),
});

export type CreateNotificationDTO = z.infer<typeof createNotificationSchema>;
