import { Request, Response } from 'express';
import { IMatchService } from './match.service';
import { expressInterestSchema } from './match.schema';
import { asyncHandler, success } from '@africonnect/shared';
import { MatchAction } from '@africonnect/shared';

export class MatchController {
  constructor(private readonly service: IMatchService) {}

  daily = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.generateDailyMatches(req.user!.userId);
    res.status(200).json(success(result.matches, { cached: result.cached }));
  });

  mutual = asyncHandler(async (req: Request, res: Response) => {
    const list = await this.service.getMutual(req.user!.userId);
    res.status(200).json(success(list));
  });

  like = asyncHandler(async (req: Request, res: Response) => {
    const body = expressInterestSchema.parse({ targetId: req.params.id, action: MatchAction.Like });
    const result = await this.service.expressInterest(req.user!.userId, body);
    res.status(200).json(success(result));
  });

  pass = asyncHandler(async (req: Request, res: Response) => {
    const body = expressInterestSchema.parse({ targetId: req.params.id, action: MatchAction.Pass });
    const result = await this.service.expressInterest(req.user!.userId, body);
    res.status(200).json(success(result));
  });

  superlike = asyncHandler(async (req: Request, res: Response) => {
    const body = expressInterestSchema.parse({
      targetId: req.params.id,
      action: MatchAction.SuperLike,
    });
    const result = await this.service.expressInterest(req.user!.userId, body);
    res.status(200).json(success(result));
  });

  /**
   * @openapi
   * /api/v1/matches/superlikes-received:
   *   get:
   *     summary: Pending superlikes the caller has received
   *     tags: [Matches]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Anonymous list of pending superlikes (no sender identity).
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean, example: true }
   *                 data:
   *                   type: object
   *                   properties:
   *                     items:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           matchId: { type: string }
   *                           createdAt: { type: string, format: date-time }
   *                           anonymous: { type: boolean, example: true }
   *                     count: { type: integer }
   *                 meta: { type: object }
   *                 error: { type: null }
   */
  superlikesReceived = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getSuperlikesReceived(req.user!.userId);
    res.status(200).json(success(result, { count: result.count }));
  });

  discover = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Math.min(50, Number(req.query.limit)) : 20;
    const cards = await this.service.discover(req.user!.userId, limit);
    res.status(200).json(success(cards));
  });

  recommend = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Math.min(50, Number(req.query.limit)) : undefined;
    const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : undefined;
    const cards = await this.service.recommend(req.user!.userId, { limit, radiusKm });
    res.status(200).json(success(cards));
  });

  preview = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Math.min(50, Number(req.query.limit)) : undefined;
    const cards = await this.service.getPreview(limit);
    res.status(200).json(success(cards));
  });
}
