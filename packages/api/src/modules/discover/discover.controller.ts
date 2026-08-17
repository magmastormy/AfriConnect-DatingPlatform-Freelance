import { Request, Response } from 'express';
import { IDiscoverService } from './discover.service';
import { nearbyQuerySchema } from './discover.schema';
import { asyncHandler, success } from '@africonnect/shared';

export class DiscoverController {
  constructor(private readonly service: IDiscoverService) {}

  nearby = asyncHandler(async (req: Request, res: Response) => {
    const query = nearbyQuerySchema.parse(req.query);
    const list = await this.service.nearby(req.user!.userId, {
      city: query.city,
      district: query.district,
      limit: query.limit,
    });
    res.status(200).json(success(list));
  });
}
