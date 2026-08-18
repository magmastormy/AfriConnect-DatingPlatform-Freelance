import { Request, Response } from 'express';
import { IVettingService } from './vetting.service';
import { asyncHandler, success, ValidationError } from '@africonnect/shared';

export class VettingController {
  constructor(private readonly service: IVettingService) {}

  createSession = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.createSession(req.user!.userId);
    res.status(201).json(success(result));
  });

  status = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getStatus(req.user!.userId);
    res.status(200).json(success(result));
  });

  /**
   * Testing-only. The phone (scanned QR) completes the simulator here. No auth:
   * the phone is not the signed-in laptop, and the session id is the capability
   * token. Only effective for sandbox sessions.
   */
  completeSandbox = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = (req.body ?? {}) as { sessionId?: string };
    if (!sessionId) throw new ValidationError('sessionId is required');
    await this.service.completeSandbox(sessionId);
    res.status(200).json(success({ approved: true }));
  });

  /** Live Smile ID callback. Raw body so the signature verifies over exact bytes. */
  webhook = asyncHandler(async (req: Request, res: Response) => {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
    const parsed = JSON.parse(raw.toString('utf8'));
    const signature = String(parsed.signature ?? req.headers['x-signature'] ?? '');
    const timestamp = String(parsed.timestamp ?? req.headers['x-timestamp'] ?? '');
    await this.service.handleWebhook(raw, signature, timestamp);
    res.status(200).json(success({ received: true }));
  });
}
