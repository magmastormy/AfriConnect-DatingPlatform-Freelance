import { Request, Response } from 'express';
import { IBillingService } from './billing.service';
import { createCheckoutSchema } from './billing.schema';
import { asyncHandler, success } from '@africonnect/shared';

export class BillingController {
  constructor(private readonly service: IBillingService) {}

  checkout = asyncHandler(async (req: Request, res: Response) => {
    const body = createCheckoutSchema.parse(req.body);
    const result = await this.service.createCheckout(req.user!.userId, body);
    res.status(200).json(success(result));
  });

  subscription = asyncHandler(async (req: Request, res: Response) => {
    const sub = await this.service.getSubscription(req.user!.userId);
    res.status(200).json(success(sub));
  });

  webhook = asyncHandler(async (req: Request, res: Response) => {
    const raw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
    const signature = req.headers['stripe-signature'] as string | undefined;
    await this.service.handleWebhook(raw, signature);
    res.status(200).json(success({ received: true }));
  });
}
