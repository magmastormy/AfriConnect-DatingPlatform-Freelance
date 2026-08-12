import { IEventRepository } from './event.repository';
import { CreateEventInput, RSVPResult } from './event.types';
import { NotFoundError, ValidationError, RSVPStatus, asEnum } from '@africonnect/shared';

export interface IEventService {
  listUpcoming(): Promise<unknown[]>;
  getById(id: string): Promise<unknown>;
  listForAdmin(): Promise<unknown[]>;
  create(input: CreateEventInput, adminId: string): Promise<unknown>;
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
  rsvp(eventId: string, userId: string): Promise<RSVPResult>;
  cancelRsvp(eventId: string, userId: string): Promise<void>;
  listRsvps(eventId: string): Promise<unknown[]>;
  star(eventId: string, starerId: string, starreeId: string): Promise<void>;
  myStars(eventId: string, userId: string): Promise<unknown[]>;
}

export class EventService implements IEventService {
  constructor(private readonly repo: IEventRepository) {}

  async listUpcoming(): Promise<unknown[]> {
    return this.repo.listUpcoming();
  }

  async getById(id: string): Promise<unknown> {
    const event = await this.repo.getById(id);
    if (!event) throw new NotFoundError('Event not found', { id });
    return event;
  }

  async listForAdmin(): Promise<unknown[]> {
    return this.repo.listAll();
  }

  async create(input: CreateEventInput, adminId: string): Promise<unknown> {
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    if (end <= start) throw new ValidationError('End time must be after start time');
    return this.repo.create(
      { ...input, startTime: start, endTime: end, status: 'published' },
      adminId,
    );
  }

  async update(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.repo.update(id, data);
  }

  async rsvp(eventId: string, userId: string): Promise<RSVPResult> {
    const rsvp = await this.repo.rsvp(eventId, userId);
    return { status: asEnum<RSVPStatus>(rsvp.status), waitlisted: rsvp.status === 'waitlist' };
  }

  async cancelRsvp(eventId: string, userId: string): Promise<void> {
    await this.repo.cancelRsvp(eventId, userId);
  }

  async listRsvps(eventId: string): Promise<unknown[]> {
    return this.repo.listRsvps(eventId);
  }

  async star(eventId: string, starerId: string, starreeId: string): Promise<void> {
    await this.repo.star(eventId, starerId, starreeId);
  }

  async myStars(eventId: string, userId: string): Promise<unknown[]> {
    return this.repo.myStars(eventId, userId);
  }
}
