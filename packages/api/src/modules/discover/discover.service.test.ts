import { DiscoverService } from './discover.service';
import { IDiscoverRepository, IViewerContext, NearbyProfile } from './discover.repository';
import {
  AuthorizationError,
  City,
  EducationLevel,
  Gender,
  NotFoundError,
  UserStatus,
  ValidationError,
} from '@africonnect/shared';

/**
 * The mocks below are fully typed on purpose. An untyped (`any`) repository mock
 * previously let `baseCtx` omit the required `nearbyEnabled` flag, so every test
 * that got past the premium gate silently tripped the "share your location"
 * guard instead of exercising the mapping logic it claimed to cover.
 */
interface MockDiscoverRepository extends IDiscoverRepository {
  getViewerContext: jest.MockedFunction<IDiscoverRepository['getViewerContext']>;
  findNearby: jest.MockedFunction<IDiscoverRepository['findNearby']>;
}

const baseCtx: IViewerContext = {
  city: City.Johannesburg,
  district: 'Sandton',
  nearbyEnabled: true,
  isPremium: true,
};

function makeRepo(
  overrides: { ctxPatch?: Partial<IViewerContext>; profiles?: NearbyProfile[] } = {},
): MockDiscoverRepository {
  return {
    getViewerContext: jest
      .fn<ReturnType<IDiscoverRepository['getViewerContext']>, [string]>()
      .mockResolvedValue({ ...baseCtx, ...overrides.ctxPatch }),
    findNearby: jest
      .fn<
        ReturnType<IDiscoverRepository['findNearby']>,
        Parameters<IDiscoverRepository['findNearby']>
      >()
      .mockResolvedValue(overrides.profiles ?? []),
  };
}

function profile(patch: Partial<NearbyProfile> = {}): NearbyProfile {
  return {
    id: 'p1',
    userId: 'u2',
    firstName: 'Aisha',
    lastName: 'B',
    displayName: 'Aisha B',
    dateOfBirth: new Date('1992-05-01'),
    gender: Gender.Female,
    nationality: 'ZA',
    city: City.Johannesburg,
    bio: 'Architect who loves weekend hikes.',
    headline: 'Building & exploring',
    profession: 'Architect',
    employer: 'Studio X',
    heightCm: 168,
    educationLevel: EducationLevel.Bachelors,
    institution: 'Wits',
    industries: ['architecture'],
    interests: ['hiking'],
    dealbreakers: [],
    photos: [{ url: 'a' }, { url: 'b' }, { url: 'c' }, { url: 'd' }, { url: 'e' }],
    preferences: null,
    privacy: null,
    isPaused: false,
    isComplete: true,
    completenessScore: 90,
    district: 'Sandton',
    nearbyEnabled: true,
    latitude: -26.1076,
    longitude: 28.0567,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'),
    user: {
      status: UserStatus.Active,
      subscriptions: { plan: 'premium', status: 'active' },
    },
    ...patch,
  };
}

describe('DiscoverService.nearby', () => {
  it('refuses non-premium viewers', async () => {
    const repo = makeRepo({ ctxPatch: { isPremium: false } });
    const svc = new DiscoverService(repo);
    await expect(svc.nearby('u1', {})).rejects.toBeInstanceOf(AuthorizationError);
    expect(repo.findNearby).not.toHaveBeenCalled();
  });

  it('refuses viewers who have not opted into Nearby', async () => {
    const repo = makeRepo({ ctxPatch: { nearbyEnabled: false } });
    const svc = new DiscoverService(repo);
    await expect(svc.nearby('u1', {})).rejects.toBeInstanceOf(ValidationError);
    expect(repo.findNearby).not.toHaveBeenCalled();
  });

  it('falls back to city-wide search when the viewer has no district', async () => {
    // `district` is optional by design: the repository widens to the whole city so
    // a shared coordinate still yields matches. It is NOT a validation failure.
    const repo = makeRepo({ ctxPatch: { district: null }, profiles: [profile()] });
    const svc = new DiscoverService(repo);
    await expect(svc.nearby('u1', {})).resolves.toHaveLength(1);
    expect(repo.findNearby).toHaveBeenCalledWith(
      expect.objectContaining({ city: City.Johannesburg, district: undefined }),
    );
  });

  it('throws NotFoundError when the viewer has no profile', async () => {
    const repo = makeRepo();
    repo.getViewerContext.mockResolvedValue(null);
    const svc = new DiscoverService(repo);
    await expect(svc.nearby('u1', {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps nearby members, caps photos at 3, excludes self', async () => {
    const repo = makeRepo({ profiles: [profile()] });
    const svc = new DiscoverService(repo);
    const out = await svc.nearby('u1', {});
    expect(out).toHaveLength(1);
    expect(out[0].userId).toBe('u2');
    expect(out[0].photos).toHaveLength(3); // capped from 5
    expect(out[0].isPremium).toBe(true);
    expect(out[0].verified).toBe(true);
    expect(out[0].bio).toContain('hikes');
    expect(out[0].age).toBeGreaterThan(30);
    expect(repo.findNearby).toHaveBeenCalledWith(
      expect.objectContaining({
        city: City.Johannesburg,
        district: 'Sandton',
        excludeUserId: 'u1',
      }),
    );
  });

  it('omits members with no date of birth instead of rendering a fake age', async () => {
    const repo = makeRepo({ profiles: [profile(), profile({ userId: 'u3', dateOfBirth: null })] });
    const svc = new DiscoverService(repo);
    const out = await svc.nearby('u1', {});
    expect(out).toHaveLength(1);
    expect(out[0].userId).toBe('u2');
  });

  it('falls back to the viewer city/district when the query omits them', async () => {
    const repo = makeRepo({ profiles: [profile()] });
    const svc = new DiscoverService(repo);
    await svc.nearby('u1', {});
    const call = repo.findNearby.mock.calls[0][0];
    expect(call.city).toBe(City.Johannesburg);
    expect(call.district).toBe('Sandton');
  });

  it('honours an explicit city override from the query', async () => {
    const repo = makeRepo({
      profiles: [profile({ city: City.CapeTown, district: 'Camps Bay' })],
    });
    const svc = new DiscoverService(repo);
    await svc.nearby('u1', { city: City.CapeTown, district: 'Camps Bay' });
    const call = repo.findNearby.mock.calls[0][0];
    expect(call.city).toBe(City.CapeTown);
    expect(call.district).toBe('Camps Bay');
  });
});
