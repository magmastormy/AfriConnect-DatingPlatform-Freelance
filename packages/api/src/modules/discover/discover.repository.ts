import { PrismaClient, Prisma, Profile } from '@prisma/client';
import { InternalError, UserStatus, City, logger } from '@africonnect/shared';

export interface DiscoverUser {
  status: UserStatus;
  // Prisma emits its own enum value types (string-literal unions); we only read
  // plan/status, so a loose shape keeps the boundary simple (runtime values are
  // identical to the shared enums).
  subscriptions: {
    plan: string;
    status: string;
  } | null;
}

export type NearbyProfile = Profile & { user: DiscoverUser };

export interface IViewerContext {
  city: City;
  district: string | null;
  nearbyEnabled: boolean;
  isPremium: boolean;
}

export interface IDiscoverRepository {
  /** Loads the caller's city/district and premium status (used for gating). */
  getViewerContext(userId: string): Promise<IViewerContext | null>;
  /** Same-district (or same-city when no district), opted-in, vetted, active members. */
  findNearby(opts: {
    city: City;
    district?: string | null;
    excludeUserId: string;
    limit: number;
  }): Promise<NearbyProfile[]>;
}

export function isPremiumSubscription(sub: { plan: string; status: string } | null): boolean {
  if (!sub) return false;
  const allowedPlan = sub.plan === 'premium' || sub.plan === 'platinum';
  const active = sub.status === 'active' || sub.status === 'trialing';
  return allowedPlan && active;
}

export class DiscoverRepository implements IDiscoverRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getViewerContext(userId: string): Promise<IViewerContext | null> {
    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        include: { user: { include: { subscriptions: true } } },
      });
      if (!profile) return null;
      return {
        city: profile.city as City,
        district: profile.district,
        nearbyEnabled: profile.nearbyEnabled,
        isPremium: isPremiumSubscription(profile.user.subscriptions),
      };
    } catch (error) {
      logger.error({ error, userId }, 'DiscoverRepository: getViewerContext failed');
      throw new InternalError('Could not load viewer context');
    }
  }

  async findNearby(opts: {
    city: City;
    district?: string | null;
    excludeUserId: string;
    limit: number;
  }): Promise<NearbyProfile[]> {
    try {
      const where: Prisma.ProfileWhereInput = {
        city: opts.city,
        nearbyEnabled: true,
        isPaused: false,
        userId: { not: opts.excludeUserId },
        // Age is a mandatory field on the Nearby card, so a member who has not
        // supplied a date of birth cannot be rendered. Exclude them here rather
        // than surfacing a placeholder age downstream.
        dateOfBirth: { not: null },
        // Only surface vetted, active members.
        user: { status: UserStatus.Active },
      };
      // District narrows the result when the member has set one; otherwise we
      // fall back to the whole city so a shared coordinate still yields matches.
      if (opts.district) where.district = opts.district;
      return (await this.prisma.profile.findMany({
        where,
        include: { user: { include: { subscriptions: true } } },
        take: opts.limit,
        orderBy: { updatedAt: 'desc' },
      })) as unknown as NearbyProfile[];
    } catch (error) {
      logger.error({ error, opts }, 'DiscoverRepository: findNearby failed');
      throw new InternalError('Could not load nearby members');
    }
  }
}
