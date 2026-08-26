import { EventService } from './event.service';
import { ValidationError } from '@africonnect/shared';
import type { IEventRepository } from './event.repository';
import type { CreateEventInput } from './event.types';

const baseInput: CreateEventInput = {
  title: 'Wine & Dine',
  description: 'A curated evening for verified professionals.',
  eventType: 'mixer' as CreateEventInput['eventType'],
  city: 'johannesburg' as CreateEventInput['city'],
  venueName: 'The Conservatory',
  venueAddress: '123 Main St',
  startTime: '2026-09-01T18:00:00.000Z',
  endTime: '2026-09-01T21:00:00.000Z',
  capacity: 50,
  ticketPrice: 0,
};

function makeRepo() {
  const calls: {
    create: Array<{ data: Record<string, unknown>; createdBy: string }>;
    listByCreator: string[];
  } = {
    create: [],
    listByCreator: [],
  };
  const repo: Partial<IEventRepository> = {
    create: async (data: Record<string, unknown>, createdBy: string) => {
      calls.create.push({ data, createdBy });
      return {
        id: 'evt_1',
        ...data,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        startTime: new Date(data.startTime as string),
        endTime: new Date(data.endTime as string),
        ticketPrice: data.ticketPrice,
      } as never;
    },
    listByCreator: async (userId: string) => {
      calls.listByCreator.push(userId);
      return [] as never;
    },
    countConfirmed: async () => 0,
  };
  return { repo: repo as IEventRepository, calls };
}

describe('EventService.submit (member self-service)', () => {
  it('creates a PENDING event owned by the submitting member', async () => {
    const { repo, calls } = makeRepo();
    const svc = new EventService(repo);
    const res = (await svc.submit(baseInput, 'user_42')) as { id: string; status: string };

    expect(calls.create).toHaveLength(1);
    expect(calls.create[0].createdBy).toBe('user_42');
    expect(calls.create[0].data.status).toBe('pending');
    expect(res.id).toBe('evt_1');
    expect(res.status).toBe('pending');
  });

  it('rejects an event whose end time is before its start time', async () => {
    const { repo } = makeRepo();
    const svc = new EventService(repo);
    await expect(
      svc.submit({ ...baseInput, endTime: '2026-09-01T10:00:00.000Z' }, 'user_42'),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('EventService.listMine', () => {
  it('delegates to the repository filtered by creator', async () => {
    const { repo, calls } = makeRepo();
    const svc = new EventService(repo);
    await svc.listMine('user_42');
    expect(calls.listByCreator).toEqual(['user_42']);
  });
});
