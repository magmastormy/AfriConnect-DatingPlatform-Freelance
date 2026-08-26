import { IDiscoverRepository, isPremiumSubscription, NearbyProfile } from './discover.repository';
import { NearbyProfileView, GetNearbyQuery } from './discover.types';
import { PROFILE_MAX_PHOTOS, City, EducationLevel, UserStatus } from '@africonnect/shared';
import { FREE_NEARBY_LIMIT } from '@africonnect/shared';
import { ValidationError, NotFoundError } from '@africonnect/shared';
import { redisGetJson, redisSetJson } from '@config/redis';
import { haversineKm } from '@modules/match/geo';

export interface IDiscoverService {
  /** Returns opted-in members near the viewer. Ungated for vetted members;
   *  free+vetted viewers receive at most FREE_NEARBY_LIMIT results. */
  nearby(viewerUserId: string, query: GetNearbyQuery): Promise<NearbyProfileView[]>;
}

/**
 * A nearby member who has supplied a date of birth. `Profile.dateOfBirth` is
 * nullable in the schema, but a Nearby card cannot render without an age, so the
 * view layer only ever handles this narrowed shape.
 */
type NearbyProfileWithDob = NearbyProfile & { dateOfBirth: Date };

function ageFrom(dob: Date | string): number {
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

export class DiscoverService implements IDiscoverService {
  constructor(private readonly repo: IDiscoverRepository) {}

  async nearby(viewerUserId: string, query: GetNearbyQuery): Promise<NearbyProfileView[]> {
    const ctx = await this.repo.getViewerContext(viewerUserId);
    if (!ctx) throw new NotFoundError('Profile not found', { userId: viewerUserId });

    // Nearby is intentionally UNGATED: any vetted member can see who is around
    // them. A single opt-in requirement remains — the member must have shared
    // their location (dropping it clears the flag, which also covers "forgot").
    if (!ctx.nearbyEnabled) {
      throw new ValidationError('Share your location to use Nearby.', {
        field: 'nearbyEnabled',
      });
    }

    // Free+vetted viewers get a small teaser set; Premium/Platinum see the full
    // district. Cap is applied server-side so a tampered client can't pull more.
    const limit = !ctx.isPremium ? FREE_NEARBY_LIMIT : (query.limit ?? 50);

    const city = query.city ?? ctx.city;
    const district = query.district ?? ctx.district ?? undefined;
    const cacheKey = `discover:nearby:${viewerUserId}:${city}:${district ?? 'all'}:${limit}`;
    if (process.env.NODE_ENV !== 'test') {
      const cached = await redisGetJson<NearbyProfileView[]>(cacheKey).catch(() => null);
      if (cached) return cached;
    }
    const profiles = await this.repo.findNearby({
      city,
      district,
      excludeUserId: viewerUserId,
      limit,
    });
    // Defence in depth: the repository already excludes members without a date of
    // birth, but the Prisma type is nullable, so narrow here rather than coercing
    // a missing DOB into a misleading age.
    const views = profiles
      .filter((p): p is NearbyProfileWithDob => p.dateOfBirth !== null)
      .map((p) => this.toView(p, { latitude: ctx.latitude, longitude: ctx.longitude }));
    if (process.env.NODE_ENV !== 'test') await redisSetJson(cacheKey, views, 20).catch(() => {});
    return views;
  }

  private toView(p: NearbyProfileWithDob, viewer: { latitude: number | null; longitude: number | null }): NearbyProfileView {
    const photos = Array.isArray(p.photos)
      ? (p.photos as Array<{ url: string }>).map((x) => x.url).slice(0, PROFILE_MAX_PHOTOS)
      : [];
    const distanceKm = haversineKm(
      { latitude: viewer.latitude, longitude: viewer.longitude },
      { latitude: p.latitude, longitude: p.longitude },
    );
    return {
      userId: p.userId,
      displayName: p.displayName ?? null,
      firstName: p.firstName,
      lastName: p.lastName,
      age: ageFrom(p.dateOfBirth),
      bio: p.bio ?? null,
      headline: p.headline ?? null,
      photos,
      city: p.city as City,
      district: p.district,
      profession: p.profession ?? null,
      employer: p.employer ?? null,
      educationLevel: (p.educationLevel as EducationLevel) ?? null,
      isPremium: isPremiumSubscription(p.user.subscriptions),
      verified: p.user.status === UserStatus.Active,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      distanceKm,
    };
  }
}
