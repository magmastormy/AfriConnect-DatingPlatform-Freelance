import { Request, Response } from 'express';
import { IAuthService, SessionContext } from './auth.service';
import {
  requestOtpSchema,
  verifyOtpSchema,
  refreshSchema,
  clerkExchangeSchema,
  requestVerificationSchema,
  confirmEmailSchema,
  requestSmsFallbackSchema,
  confirmSmsFallbackSchema,
} from './auth.schema';
import { asyncHandler } from '@africonnect/shared';
import { success } from '@africonnect/shared';
import { getDeviceId } from '@config/middleware/device';
import { VerificationService } from './verification.service';

function ctxFrom(req: Request): SessionContext {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    null;
  return { deviceId: getDeviceId(req), ip };
}

export class AuthController {
  constructor(
    private readonly authService: IAuthService,
    private readonly verification: VerificationService,
  ) {}

  requestOtp = asyncHandler(async (req: Request, res: Response) => {
    const body = requestOtpSchema.parse(req.body);
    const result = await this.authService.requestOtp(body);
    res.status(200).json(success(result));
  });

  verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const body = verifyOtpSchema.parse(req.body);
    const result = await this.authService.verifyOtp(body, ctxFrom(req));
    res.status(200).json(success(result));
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await this.authService.refresh(refreshToken, ctxFrom(req));
    res.status(200).json(success(result));
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.body?.refreshToken;
    if (refreshToken) await this.authService.logout(refreshToken);
    res.status(204).send();
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(success({ user: req.user }));
  });

  clerkExchange = asyncHandler(async (req: Request, res: Response) => {
    const { token } = clerkExchangeSchema.parse(req.body);
    const result = await this.authService.verifyClerk(token, ctxFrom(req));
    res.status(200).json(success(result));
  });

  // ── Verification: EMAIL-PRIMARY, SMS-FALLBACK (see VerificationService) ──
  requestVerification = asyncHandler(async (req: Request, res: Response) => {
    const { email } = requestVerificationSchema.parse(req.body);
    const result = await this.verification.requestVerification(email);
    res.status(200).json(success(result));
  });

  confirmEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = confirmEmailSchema.parse(req.body);
    await this.verification.confirmEmail(token);
    res.status(200).json(success({ verified: true }));
  });

  requestSmsFallback = asyncHandler(async (req: Request, res: Response) => {
    const { phone } = requestSmsFallbackSchema.parse(req.body);
    const result = await this.verification.requestSmsFallback(phone);
    res.status(200).json(success(result));
  });

  confirmSmsFallback = asyncHandler(async (req: Request, res: Response) => {
    const { phone, code } = confirmSmsFallbackSchema.parse(req.body);
    await this.verification.confirmSmsFallback(phone, code);
    res.status(200).json(success({ verified: true }));
  });
}
