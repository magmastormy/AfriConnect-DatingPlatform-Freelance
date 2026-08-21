import { IDiscoverRepository, isPremiumSubscription, NearbyProfile } from './discover.repository';
import { NearbyProfileView, GetNearbyQuery } from './discover.types';
import { PROFILE_MAX_PHOTOS, City, EducationLevel, UserStatus } from '@africonnect/shared';
import { AuthorizationError, ValidationError, NotFoundError } from '@africonnect/shared';
import { redisGetJson, redisSetJson } from '@config/redis';

export interface IDiscoverService {
  /** Returns opted-in members in the viewer's district. Premium-gated. */
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

    // WeChat-Nearby is a PREMIUM feature for the viewer. Enforced server-side.
    if (!ctx.isPremium) {
      throw new AuthorizationError(
        'Nearby is a Premium feature. Upgrade to see members around you.',
      );
    }

    // The member must have opted into Nearby (and shared a location). When they
    // drop their location the flag is cleared, so this also covers "forgot".
    if (!ctx.nearbyEnabled) {
      throw new ValidationError('Share your location to use Nearby.', {
        field: 'nearbyEnabled',
      });
    }

    const city = query.city ?? ctx.city;
    const district = query.district ?? ctx.district ?? undefined;
    const cacheKey = `discover:nearby:${viewerUserId}:${city}:${district ?? 'all'}:${query.limit ?? 50}`;
    if (process.env.NODE_ENV !== 'test') {
      const cached = await redisGetJson<NearbyProfileView[]>(cacheKey).catch(() => null);
      if (cached) return cached;
    }
    const profiles = await this.repo.findNearby({
      city,
      district,
      excludeUserId: viewerUserId,
      limit: query.limit ?? 50,
    });
    // Defence in depth: the repository already excludes members without a date of
    // birth, but the Prisma type is nullable, so narrow here rather than coercing
    // a missing DOB into a misleading age.
    const views = profiles
      .filter((p): p is NearbyProfileWithDob => p.dateOfBirth !== null)
      .map((p) => this.toView(p));
    if (process.env.NODE_ENV !== 'test') await redisSetJson(cacheKey, views, 20).catch(() => {});
    return views;
  }

  private toView(p: NearbyProfileWithDob): NearbyProfileView {
    const photos = Array.isArray(p.photos)
      ? (p.photos as Array<{ url: string }>).map((x) => x.url).slice(0, PROFILE_MAX_PHOTOS)
      : [];
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
    };
  }
}
