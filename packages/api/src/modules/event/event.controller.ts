import { Request, Response } from 'express';
import { IEventService } from './event.service';
import { createEventSchema, updateEventSchema } from './event.schema';
import { asyncHandler, success } from '@africonnect/shared';
import { z } from 'zod';

const starSchema = z.object({ starreeId: z.string().min(1) });

export class EventController {
  constructor(private readonly service: IEventService) {}

  list = asyncHandler(async (_req: Request, res: Response) => {
    const events = await this.service.listUpcoming();
    res.status(200).json(success(events));
  });

  detail = asyncHandler(async (req: Request, res: Response) => {
    const event = await this.service.getById(req.params.id);
    res.status(200).json(success(event));
  });

  attendees = asyncHandler(async (req: Request, res: Response) => {
    // Only anonymized first name + profession are exposed (MVP star system).
    const attendees = await this.service.listAttendees(req.params.id);
    res.status(200).json(success(attendees));
  });

  rsvp = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.rsvp(req.params.id, req.user!.userId);
    res.status(200).json(success(result));
  });

  cancelRsvp = asyncHandler(async (req: Request, res: Response) => {
    await this.service.cancelRsvp(req.params.id, req.user!.userId);
    res.status(200).json(success({ cancelled: true }));
  });

  star = asyncHandler(async (req: Request, res: Response) => {
    const { starreeId } = starSchema.parse(req.body);
    await this.service.star(req.params.id, req.user!.userId, starreeId);
    res.status(200).json(success({ starred: true }));
  });

  myStars = asyncHandler(async (req: Request, res: Response) => {
    const stars = await this.service.myStars(req.params.id, req.user!.userId);
    res.status(200).json(success(stars));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = createEventSchema.parse(req.body);
    const event = await this.service.create(body, req.user!.userId);
    res.status(201).json(success(event));
  });

  createMine = asyncHandler(async (req: Request, res: Response) => {
    const body = createEventSchema.parse(req.body);
    const event = await this.service.submit(body, req.user!.userId);
    res.status(201).json(success(event));
  });

  listMine = asyncHandler(async (req: Request, res: Response) => {
    const events = await this.service.listMine(req.user!.userId);
    res.status(200).json(success(events));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const body = updateEventSchema.parse(req.body);
    const event = await this.service.update(req.params.id, body as Record<string, unknown>);
    res.status(200).json(success(event));
  });

  exportRsvps = asyncHandler(async (req: Request, res: Response) => {
    const rsvps = await this.service.listRsvps(req.params.id);
    res.status(200).json(success(rsvps, { total: rsvps.length }));
  });
}
