import { Request, Response } from 'express';
import { IAdminAuthService } from './adminAuth.service';
import { adminLoginSchema, adminBootstrapSchema, adminRefreshSchema } from './adminAuth.schema';
import { asyncHandler, success } from '@africonnect/shared';

export class AdminAuthController {
  constructor(private readonly service: IAdminAuthService) {}

  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = adminLoginSchema.parse(req.body);
    const deviceId = (req.headers['x-device-id'] as string) || null;
    const ip = req.ip;
    const result = await this.service.login(email, password, { deviceId, ip });
    res.status(200).json(success(result));
  });

  bootstrap = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, setupToken } = adminBootstrapSchema.parse(req.body);
    const deviceId = (req.headers['x-device-id'] as string) || null;
    const ip = req.ip;
    const result = await this.service.bootstrap(email, password, setupToken, { deviceId, ip });
    res.status(201).json(success(result));
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = adminRefreshSchema.parse(req.body);
    const deviceId = (req.headers['x-device-id'] as string) || null;
    const ip = req.ip;
    const result = await this.service.refresh(refreshToken, { deviceId, ip });
    res.status(200).json(success(result));
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = adminRefreshSchema.parse(req.body);
    await this.service.logout(refreshToken);
    res.status(200).json(success({ loggedOut: true }));
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    // authorize() already verified JWT and set req.user
    res.status(200).json(success({ user: req.user }));
  });
}
