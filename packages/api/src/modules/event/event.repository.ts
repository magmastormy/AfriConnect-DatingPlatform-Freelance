import { PrismaClient, Event, RSVP } from '@prisma/client';
import { NotFoundError, ConflictError, InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';

export interface IEventRepository {
  listUpcoming(): Promise<Event[]>;
  listAll(): Promise<Event[]>;
  getById(id: string): Promise<Event | null>;
  create(data: Record<string, unknown>, adminId: string): Promise<Event>;
  update(id: string, data: Record<string, unknown>): Promise<Event>;
  listByCreator(userId: string): Promise<Event[]>;
  rsvp(eventId: string, userId: string): Promise<RSVP>;
  cancelRsvp(eventId: string, userId: string): Promise<void>;
  listRsvps(eventId: string): Promise<RSVP[]>;
  star(eventId: string, starerId: string, starreeId: string): Promise<void>;
  myStars(eventId: string, userId: string): Promise<unknown[]>;
  countConfirmed(eventId: string): Promise<number>;
}

export class EventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listUpcoming(): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { status: 'published', startTime: { gt: new Date() } },
      orderBy: { startTime: 'asc' },
    });
  }

  async listAll(): Promise<Event[]> {
    return this.prisma.event.findMany({ orderBy: { startTime: 'desc' } });
  }

  async getById(id: string): Promise<Event | null> {
    return this.prisma.event.findUnique({ where: { id } });
  }

  async create(data: Record<string, unknown>, adminId: string): Promise<Event> {
    try {
      return await this.prisma.event.create({ data: { ...data, createdBy: adminId } as Event });
    } catch (error) {
      logger.error({ error }, 'EventRepository: create failed');
      throw new InternalError('Could not create event');
    }
  }

  async update(id: string, data: Record<string, unknown>): Promise<Event> {
    const existing = await this.getById(id);
    if (!existing) throw new NotFoundError('Event not found', { id });
    try {
      return await this.prisma.event.update({ where: { id }, data: data as Event });
    } catch (error) {
      logger.error({ error, id }, 'EventRepository: update failed');
      throw new InternalError('Could not update event');
    }
  }

  async listByCreator(userId: string): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { createdBy: userId },
      orderBy: { startTime: 'desc' },
    });
  }

  async rsvp(eventId: string, userId: string): Promise<RSVP> {
    const event = await this.getById(eventId);
    if (!event) throw new NotFoundError('Event not found', { eventId });
    const existing = await this.prisma.rSVP.findFirst({ where: { eventId, userId } });
    if (existing && existing.status !== 'cancelled') {
      throw new ConflictError('Already RSVPd to this event');
    }
    const confirmed = await this.countConfirmed(eventId);
    const status = confirmed >= event.capacity ? 'waitlist' : 'confirmed';
    return this.prisma.rSVP.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status },
      update: { status },
    });
  }

  async cancelRsvp(eventId: string, userId: string): Promise<void> {
    await this.prisma.rSVP.updateMany({
      where: { eventId, userId },
      data: { status: 'cancelled' },
    });
  }

  async listRsvps(eventId: string): Promise<RSVP[]> {
    return this.prisma.rSVP.findMany({
      where: { eventId, status: { in: ['confirmed', 'waitlist'] } },
      orderBy: [{ createdAt: 'asc' }],
      include: { user: { include: { profile: true } } },
    });
  }

  async star(eventId: string, starerId: string, starreeId: string): Promise<void> {
    if (starerId === starreeId) throw new ConflictError('Cannot star yourself');

    // Upsert this side of the star.
    await this.prisma.eventStar.upsert({
      where: { eventId_starerId_starreeId: { eventId, starerId, starreeId } },
      create: { eventId, starerId, starreeId, isMutual: false },
      update: {},
    });

    // If the other person already starred this viewer, both stars become mutual
    // and are revealed (the "mutual interest" moment).
    const reciprocal = await this.prisma.eventStar.findUnique({
      where: { eventId_starerId_starreeId: { eventId, starerId: starreeId, starreeId: starerId } },
    });
    if (reciprocal) {
      const revealedAt = new Date();
      await this.prisma.eventStar.update({
        where: { eventId_starerId_starreeId: { eventId, starerId, starreeId } },
        data: { isMutual: true, revealedAt },
      });
      await this.prisma.eventStar.update({
        where: {
          eventId_starerId_starreeId: { eventId, starerId: starreeId, starreeId: starerId },
        },
        data: { isMutual: true, revealedAt },
      });
      logger.info({ eventId, starerId, starreeId }, 'Mutual star revealed');
    }
  }

  async myStars(eventId: string, userId: string): Promise<unknown[]> {
    return this.prisma.eventStar.findMany({
      where: { eventId, starerId: userId, isMutual: true },
    });
  }

  async countConfirmed(eventId: string): Promise<number> {
    return this.prisma.rSVP.count({ where: { eventId, status: 'confirmed' } });
  }
}
