import { Request, Response } from 'express';
import { INotificationService } from './notification.service';
import { asyncHandler, success } from '@africonnect/shared';
import { bulkNotifySchema } from './notification.routes';

export class NotificationController {
  constructor(private readonly service: INotificationService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || undefined;
    const limit = Number(req.query.limit) || undefined;
    const list = await this.service.list(req.user!.userId, page, limit);
    res.status(200).json(success(list, { total: list.length }));
  });

  markRead = asyncHandler(async (req: Request, res: Response) => {
    await this.service.markRead(req.params.id, req.user!.userId);
    res.status(200).json(success({ marked: true }));
  });

  unreadCount = asyncHandler(async (req: Request, res: Response) => {
    const count = await this.service.unreadCount(req.user!.userId);
    res.status(200).json(success({ count }));
  });

  markAllRead = asyncHandler(async (req: Request, res: Response) => {
    await this.service.markAllRead(req.user!.userId);
    res.status(200).json(success({ marked: true }));
  });

  bulk = asyncHandler(async (req: Request, res: Response) => {
    const body = bulkNotifySchema.parse(req.body);
    const { queued } = await this.service.bulk(body);
    res.status(202).json(success({ queued }));
  });
}
