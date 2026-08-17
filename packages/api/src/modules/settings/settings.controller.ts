import { Request, Response } from 'express';
import { ISettingsService } from './settings.service';
import { asyncHandler, success } from '@africonnect/shared';
import { updateSettingsSchema } from './settings.schema';

export class SettingsController {
  constructor(private readonly service: ISettingsService) {}

  getSettings = asyncHandler(async (_req: Request, res: Response) => {
    const data = await this.service.getSettings();
    res.status(200).json(success(data));
  });

  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const body = updateSettingsSchema.parse(req.body);
    const data = await this.service.updateSettings(body, req.user!.userId);
    res.status(200).json(success(data));
  });
}
