import { Request, Response } from 'express';
import { IProfileService } from './profile.service';
import {
  createProfileSchema,
  updatePreferencesSchema,
  updatePrivacySchema,
  addPhotoSchema,
} from './profile.schema';
import { asyncHandler, success, ValidationError } from '@africonnect/shared';

export class ProfileController {
  constructor(private readonly service: IProfileService) {}

  getOwn = asyncHandler(async (req: Request, res: Response) => {
    const profile = await this.service.getOwn(req.user!.userId);
    res.status(200).json(success(profile));
  });

  upsert = asyncHandler(async (req: Request, res: Response) => {
    const body = createProfileSchema.parse(req.body);
    const profile = await this.service.upsert(req.user!.userId, body);
    res.status(200).json(success(profile));
  });

  updatePreferences = asyncHandler(async (req: Request, res: Response) => {
    const body = updatePreferencesSchema.parse(req.body);
    const profile = await this.service.updatePreferences(req.user!.userId, body);
    res.status(200).json(success(profile));
  });

  updatePrivacy = asyncHandler(async (req: Request, res: Response) => {
    const body = updatePrivacySchema.parse(req.body);
    const profile = await this.service.updatePrivacy(req.user!.userId, body);
    res.status(200).json(success(profile));
  });

  addPhoto = asyncHandler(async (req: Request, res: Response) => {
    const body = addPhotoSchema.parse(req.body);
    const profile = await this.service.addPhoto(req.user!.userId, body.url, body.isPrimary);
    res.status(201).json(success(profile));
  });

  removePhoto = asyncHandler(async (req: Request, res: Response) => {
    const url = req.body?.url;
    if (!url) throw new ValidationError('Photo url required');
    const profile = await this.service.removePhoto(req.user!.userId, url);
    res.status(200).json(success(profile));
  });

  pause = asyncHandler(async (req: Request, res: Response) => {
    const paused = Boolean(req.body?.paused);
    const profile = await this.service.pause(req.user!.userId, paused);
    res.status(200).json(success(profile));
  });
}
