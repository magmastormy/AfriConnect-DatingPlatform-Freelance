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

  discover = asyncHandler(async (req: Request, res: Response) => {
    const limit = req.query.limit ? Math.min(50, Number(req.query.limit)) : 20;
    const cards = await this.service.discover(req.user!.userId, limit);
    res.status(200).json(success(cards));
  });
}
