import { Request, Response } from 'express';
import { IApplicationService } from './application.service';
import { createApplicationSchema, reviewApplicationSchema } from './application.schema';
import { asyncHandler, success, ValidationError } from '@africonnect/shared';
import { authorize } from '@config/middleware';
import { UserRole, ApplicationStatus } from '@africonnect/shared';

export class ApplicationController {
  constructor(private readonly service: IApplicationService) {}

  submit = asyncHandler(async (req: Request, res: Response) => {
    const body = createApplicationSchema.parse(req.body);
    const result = await this.service.submit(body, req.user);
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

export function applicationRoutes(controller: ApplicationController): import('express').Router {
  const { Router } = require('express');
  const router = Router();
  router.post('/', controller.submit);
  router.get('/me', authorize(), controller.getOwn);
  router.get('/admin', authorize(UserRole.Admin, UserRole.SuperAdmin), controller.listAdmin);
  router.put('/admin/:id', authorize(UserRole.Admin, UserRole.SuperAdmin), controller.review);
  return router;
}
