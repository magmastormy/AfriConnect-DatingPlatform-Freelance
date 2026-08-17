import { Request, Response } from 'express';
import { IApplicationService } from './application.service';
import { createApplicationSchema, reviewApplicationSchema } from './application.schema';
import { asyncHandler, success, ValidationError } from '@africonnect/shared';
import { ApplicationStatus } from '@africonnect/shared';

export class ApplicationController {
  constructor(private readonly service: IApplicationService) {}

  /**
   * Submits a vetting application for the authenticated caller.
   *
   * Vetting is account-first: the route is mounted behind authorize(), so
   * req.user is always present here and the application is always bound to a
   * real account. Anonymous applications are no longer accepted — they produced
   * orphaned records that no member could ever see the status of.
   */
  submit = asyncHandler(async (req: Request, res: Response) => {
    const body = createApplicationSchema.parse(req.body);
    const result = await this.service.submit(body, req.user!);
    res.status(201).json(success(result));
  });

  getOwn = asyncHandler(async (req: Request, res: Response) => {
    const view = await this.service.getOwn(req.user!.userId);
    res.status(200).json(success(view));
  });

  listAdmin = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as ApplicationStatus | undefined;
    if (status && !Object.values(ApplicationStatus).includes(status)) {
      throw new ValidationError('Invalid status filter');
    }
    const views = await this.service.listForAdmin(status ? { status } : undefined);
    res.status(200).json(success(views, { total: views.length }));
  });

  review = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const body = reviewApplicationSchema.parse(req.body);
    const view = await this.service.review(id, body, req.user!);
    res.status(200).json(success(view));
  });
}
