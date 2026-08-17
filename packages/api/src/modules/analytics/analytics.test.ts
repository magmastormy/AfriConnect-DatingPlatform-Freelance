import { AnalyticsRepository } from './analytics.repository';

const makePrisma = () => ({
  profileView: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  match: { findMany: jest.fn() },
  rSVP: { findMany: jest.fn() },
});

describe('AnalyticsRepository', () => {
  it('skips self-views without writing', async () => {
    const p = makePrisma();
    const repo = new AnalyticsRepository(p as never);
    const recorded = await repo.recordView('u1', 'u1');
    expect(recorded).toBe(false);
    expect(p.profileView.create).not.toHaveBeenCalled();
  });

  it('skips views inside the cooldown window', async () => {
    const p = makePrisma();
    p.profileView.findFirst.mockResolvedValue({ id: 'existing' });
    const repo = new AnalyticsRepository(p as never);
    const recorded = await repo.recordView('u1', 'u2');
    expect(recorded).toBe(false);
    expect(p.profileView.create).not.toHaveBeenCalled();
  });

  it('records a fresh view', async () => {
    const p = makePrisma();
    p.profileView.findFirst.mockResolvedValue(null);
    p.profileView.create.mockResolvedValue({ id: 'new' });
    const repo = new AnalyticsRepository(p as never);
    const recorded = await repo.recordView('u1', 'u2');
    expect(recorded).toBe(true);
    expect(p.profileView.create).toHaveBeenCalledWith({
      data: { viewerId: 'u1', viewedUserId: 'u2' },
    });
  });

  it('buckets counts by UTC day with gaps filled and correct totals', async () => {
    const p = makePrisma();
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    p.profileView.findMany.mockResolvedValue([{ createdAt: today }, { createdAt: yesterday }]);
    p.match.findMany.mockResolvedValue([]);
    p.rSVP.findMany.mockResolvedValue([]);

    const repo = new AnalyticsRepository(p as never);
    const bundle = await repo.getBundle('u1', 7);

    expect(bundle.windowDays).toBe(7);
    expect(bundle.series.profileViews).toHaveLength(7);
    expect(bundle.series.profileViews.filter((b) => b.count === 1)).toHaveLength(2);
    expect(bundle.totals.profileViews).toBe(2);
    expect(bundle.totals.likesSent).toBe(0);
  });
});
