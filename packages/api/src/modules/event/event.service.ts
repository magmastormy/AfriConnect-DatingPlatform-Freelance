import { IEventRepository } from './event.repository';
import { CreateEventInput, RSVPResult } from './event.types';
import { NotFoundError, ValidationError, RSVPStatus, asEnum } from '@africonnect/shared';
import { redisGetJson, redisSetJson, redisDel } from '@config/redis';

export interface IEventService {
  listUpcoming(): Promise<unknown[]>;
  getById(id: string): Promise<unknown>;
  listForAdmin(): Promise<unknown[]>;
  create(input: CreateEventInput, adminId: string): Promise<unknown>;
  submit(input: CreateEventInput, userId: string): Promise<unknown>;
  listMine(userId: string): Promise<unknown[]>;
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
  rsvp(eventId: string, userId: string): Promise<RSVPResult>;
  cancelRsvp(eventId: string, userId: string): Promise<void>;
  listRsvps(eventId: string): Promise<unknown[]>;
  listAttendees(eventId: string): Promise<
    Array<{
      userId: string;
      firstName: string;
      profession: string | null;
      status: string;
      isWaitlisted: boolean;
    }>
  >;
  star(eventId: string, starerId: string, starreeId: string): Promise<void>;
  myStars(eventId: string, userId: string): Promise<unknown[]>;
}

export class EventService implements IEventService {
  constructor(private readonly repo: IEventRepository) {}

  /** Normalises a stored Event for the API: Prisma Decimals and Dates cannot be
   *  JSON-serialised as-is (a Decimal serialises to {"s":...,"e":...}, which is
   *  what made ticket prices render as an object on the events page). */
  private async toView(event: {
    id: string;
    title: string;
    description: string;
    eventType: string;
    city: string;
    venueName: string;
    startTime: Date;
    endTime: Date;
    capacity: number;
    ticketPrice: unknown;
    status: string;
    featured: boolean;
  }) {
    const [price, attendeeCount] = [
      event.ticketPrice as { toString?: () => string } | null | undefined,
      await this.repo.countConfirmed(event.id),
    ];
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      city: event.city,
      venueName: event.venueName,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      capacity: event.capacity,
      ticketPrice: price && typeof price.toString === 'function' ? Number(price.toString()) : 0,
      status: event.status,
      featured: event.featured,
      attendeeCount,
    };
  }

  async listUpcoming(): Promise<unknown[]> {
    if (process.env.NODE_ENV !== 'test') {
      const cacheKey = 'events:upcoming';
      const cached = await redisGetJson<unknown[]>(cacheKey).catch(() => null);
      if (cached) return cached;
      const events = await this.repo.listUpcoming();
      const views = await Promise.all(events.map((e) => this.toView(e)));
      await redisSetJson(cacheKey, views, 30).catch(() => {});
      return views;
    }
    const events = await this.repo.listUpcoming();
    return Promise.all(events.map((e) => this.toView(e)));
  }

  async getById(id: string): Promise<unknown> {
    if (process.env.NODE_ENV !== 'test') {
      const cacheKey = `events:${id}`;
      const cached = await redisGetJson<unknown>(cacheKey).catch(() => null);
      if (cached) return cached;
      const event = await this.repo.getById(id);
      if (!event) throw new NotFoundError('Event not found', { id });
      const view = await this.toView(event);
      await redisSetJson(cacheKey, view, 30).catch(() => {});
      return view;
    }
    const event = await this.repo.getById(id);
    if (!event) throw new NotFoundError('Event not found', { id });
    return this.toView(event);
  }

  async listForAdmin(): Promise<unknown[]> {
    const events = await this.repo.listAll();
    return Promise.all(events.map((e) => this.toView(e)));
  }

  async create(input: CreateEventInput, adminId: string): Promise<unknown> {
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    if (end <= start) throw new ValidationError('End time must be after start time');
    const created = await this.repo.create(
      { ...input, startTime: start, endTime: end, status: 'published' },
      adminId,
    );
    await redisDel('events:upcoming').catch(() => {});
    return created;
  }

  async update(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.repo.update(id, data);
  }

  /**
   * Member self-service event submission. Creates the event in the `pending`
   * state (awaiting admin review) and records the submitting member as the
   * creator. Admins later publish/cancel via moderation. Validation mirrors the
   * admin `create` path.
   */
  async submit(input: CreateEventInput, userId: string): Promise<unknown> {
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    if (end <= start) throw new ValidationError('End time must be after start time');
    const event = await this.repo.create(
      { ...input, startTime: start, endTime: end, status: 'pending' },
      userId,
    );
    return this.toView(event);
  }

  /** Events created by the calling member, newest first (all statuses). */
  async listMine(userId: string): Promise<unknown[]> {
    const events = await this.repo.listByCreator(userId);
    return Promise.all(events.map((e) => this.toView(e)));
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

  /**
   * Attendee roster for the public event view.
   *
   * Projects only what the MVP star system should reveal: first name and
   * profession. The web client calls /events/:id/attendees and renders these
   * cards, so the shape here is the contract — a raw RSVP row would render as
   * an empty card. PII beyond first name is deliberately withheld.
   */
  async listAttendees(eventId: string): Promise<
    Array<{
      userId: string;
      firstName: string;
      profession: string | null;
      status: string;
      isWaitlisted: boolean;
    }>
  > {
    const rsvps = await this.repo.listRsvps(eventId);
    return rsvps.map((r) => {
      const profile = (
        r as { user?: { profile?: { firstName?: string; profession?: string | null } } }
      ).user?.profile;
      return {
        userId: (r as { userId: string }).userId,
        firstName: profile?.firstName ?? 'Member',
        profession: profile?.profession ?? null,
        status: (r as { status: string }).status,
        isWaitlisted: (r as { status: string }).status === 'waitlist',
      };
    });
  }

  async star(eventId: string, starerId: string, starreeId: string): Promise<void> {
    await this.repo.star(eventId, starerId, starreeId);
  }

  async myStars(eventId: string, userId: string): Promise<unknown[]> {
    return this.repo.myStars(eventId, userId);
  }
}
