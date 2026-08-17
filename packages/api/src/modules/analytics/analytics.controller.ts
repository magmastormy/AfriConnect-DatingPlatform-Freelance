import { Request, Response } from 'express';
import { asyncHandler, success, ValidationError } from '@africonnect/shared';
import { authorize } from '@config/middleware';
import { ANALYTICS_DEFAULT_WINDOW } from '@africonnect/shared';
import { IAnalyticsService } from './analytics.service';
import { profileViewSchema, analyticsWindowSchema } from './analytics.schema';

export class AnalyticsController {
  constructor(private readonly service: IAnalyticsService) {}

  /**
   * POST /analytics/profile-view — fire-and-forget tracking call made when a
   * profile/discovery card is viewed. Returns whether the view was recorded
   * (false = self-view or within the cooldown).
   */
  track = [
    authorize(),
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user) throw new ValidationError('Unauthenticated');
      const { viewedUserId } = profileViewSchema.parse(req.body);
      const recorded = await this.service.recordView(req.user.userId, viewedUserId);
      res.status(200).json(success({ recorded }));
    }),
  ];

  /** GET /analytics/me?window=7|30|90 — dashboard time-series for the caller. */
  me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new ValidationError('Unauthenticated');
    const { window } = analyticsWindowSchema.parse(req.query);
    const w = ([7, 30, 90].includes(window) ? window : ANALYTICS_DEFAULT_WINDOW) as 7 | 30 | 90;
    const bundle = await this.service.getBundle(req.user.userId, w);
    res.status(200).json(success(bundle));
  });
}
