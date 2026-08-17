import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { INotificationService } from './notification.service';
import { authorize } from '@config/middleware';
import { UserRole, NotificationChannel } from '@africonnect/shared';
import { z } from 'zod';

export const bulkNotifySchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  channel: z.nativeEnum(NotificationChannel),
  role: z.nativeEnum(UserRole).optional(),
  data: z.record(z.unknown()).optional(),
});

export function notificationRoutes(
  controller: NotificationController,
  _service: INotificationService,
): Router {
  const router = Router();
  router.get('/', authorize(), controller.list);
  router.get('/unread-count', authorize(), controller.unreadCount);
  router.put('/read-all', authorize(), controller.markAllRead);
  router.put('/:id/read', authorize(), controller.markRead);
  router.post('/admin', authorize(UserRole.Admin, UserRole.SuperAdmin), controller.bulk);
  return router;
}
