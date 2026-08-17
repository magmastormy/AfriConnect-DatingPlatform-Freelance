import { Prisma, PrismaClient, Profile } from '@prisma/client';
import { NotFoundError, ConflictError, InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import { PROFILE_MAX_PHOTOS } from '@africonnect/shared';

export interface IProfileRepository {
  findByUserId(userId: string): Promise<Profile | null>;
  findByUserIds(userIds: string[]): Promise<Profile[]>;
  create(userId: string, data: Record<string, unknown>): Promise<Profile>;
  update(userId: string, data: Record<string, unknown>): Promise<Profile>;
  addPhoto(
    userId: string,
    photo: { url: string; order: number; isPrimary: boolean },
  ): Promise<Profile>;
  removePhoto(userId: string, url: string): Promise<Profile>;
  updateNearby(
    userId: string,
    data: {
      district?: string | null;
      nearbyEnabled?: boolean;
      latitude?: number | null;
      longitude?: number | null;
    },
  ): Promise<Profile>;
  setPaused(userId: string, paused: boolean): Promise<Profile>;
  findMatches(criteria: unknown, pagination: { skip: number; take: number }): Promise<Profile[]>;
  /** Loads a profile together with its owner's subscription/status for tier gating. */
  findProfileWithUser(userId: string): Promise<
    | (Profile & {
        user: {
          status: string;
          role: string;
          subscriptions: { plan: string; status: string } | null;
        };
      })
    | null
  >;
}

/** A user's effective membership tier (free vs premium) derived from subscription. */
export interface TierContext {
  isPremium: boolean;
  isVetted: boolean;
}

export function tierFromUser(user: {
  status: string;
  role: string;
  subscriptions: { plan: string; status: string } | null;
}): TierContext {
  const isVetted = (user.role === 'member' || user.role === 'premium') && user.status === 'active';
  const sub = user.subscriptions;
  const isPremium = Boolean(
    sub &&
    (sub.plan === 'premium' || sub.plan === 'platinum') &&
    (sub.status === 'active' || sub.status === 'trialing'),
  );
  return { isPremium, isVetted };
}

const COMPLETENESS_FIELDS = [
  'bio',
  'profession',
  'employer',
  'educationLevel',
  'interests',
  'photos',
];

export class ProfileRepository implements IProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    try {
      return await this.prisma.profile.findUnique({ where: { userId } });
    } catch (error) {
      logger.error({ error, userId }, 'ProfileRepository: findByUserId failed');
      throw new InternalError('Database operation failed', { userId });
    }
  }

  async findByUserIds(userIds: string[]): Promise<Profile[]> {
    if (!userIds.length) return [];
    try {
      return await this.prisma.profile.findMany({ where: { userId: { in: userIds } } });
    } catch (error) {
      logger.error({ error, count: userIds.length }, 'ProfileRepository: findByUserIds failed');
      throw new InternalError('Database operation failed');
    }
  }

  async create(userId: string, data: Record<string, unknown>): Promise<Profile> {
    try {
      return await this.prisma.profile.create({
        data: {
          userId,
          ...data,
          completenessScore: this.calculateCompleteness(data),
          isComplete: this.calculateCompleteness(data) >= 80,
        } as Prisma.ProfileUncheckedCreateInput,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictError('Profile already exists for this user');
      }
      logger.error({ error, userId }, 'ProfileRepository: create failed');
      throw new InternalError('Profile creation failed');
    }
  }

  async update(userId: string, data: Record<string, unknown>): Promise<Profile> {
    const existing = await this.findByUserId(userId);
    if (!existing) throw new NotFoundError('Profile not found', { userId });
    try {
      return await this.prisma.profile.update({
        where: { userId },
        data: {
          ...data,
          completenessScore: this.calculateCompleteness({ ...existing, ...data }),
        },
      });
    } catch (error) {
      logger.error({ error, userId }, 'ProfileRepository: update failed');
      throw new InternalError('Profile update failed', { userId });
    }
  }

  async addPhoto(
    userId: string,
    photo: { url: string; order: number; isPrimary: boolean },
  ): Promise<Profile> {
    const existing = await this.findByUserId(userId);
    if (!existing) throw new NotFoundError('Profile not found', { userId });
    const photos: Array<{ url: string; order: number; isPrimary: boolean }> = Array.isArray(
      existing.photos,
    )
      ? (existing.photos as Array<{ url: string; order: number; isPrimary: boolean }>)
      : [];
    if (photos.length >= PROFILE_MAX_PHOTOS) {
      throw new ConflictError('Maximum number of photos reached');
    }
    photos.push(photo);
    return this.update(userId, { photos });
  }

  async removePhoto(userId: string, url: string): Promise<Profile> {
    const existing = await this.findByUserId(userId);
    if (!existing) throw new NotFoundError('Profile not found', { userId });
    const photos = (
      (Array.isArray(existing.photos) ? existing.photos : []) as Array<{ url: string }>
    ).filter((p: { url: string }) => p.url !== url);
    return this.update(userId, { photos });
  }

  async updateNearby(
    userId: string,
    data: {
      district?: string | null;
      nearbyEnabled?: boolean;
      latitude?: number | null;
      longitude?: number | null;
    },
  ): Promise<Profile> {
    const existing = await this.findByUserId(userId);
    if (!existing) throw new NotFoundError('Profile not found', { userId });
    // Dropping Nearby (opt-out) forgets the shared location entirely so no
    // stale coordinates linger in the database.
    if (data.nearbyEnabled === false) {
      return this.update(userId, {
        nearbyEnabled: false,
        district: null,
        latitude: null,
        longitude: null,
      });
    }
    return this.update(userId, data);
  }

  async setPaused(userId: string, paused: boolean): Promise<Profile> {
    return this.update(userId, { isPaused: paused });
  }

  async findMatches(
    criteria: unknown,
    { skip, take }: { skip: number; take: number },
  ): Promise<Profile[]> {
    return this.prisma.profile.findMany({
      where: criteria as Record<string, unknown>,
      skip,
      take,
    });
  }

  async findProfileWithUser(userId: string): Promise<
    | (Profile & {
        user: {
          status: string;
          role: string;
          subscriptions: { plan: string; status: string } | null;
        };
      })
    | null
  > {
    try {
      return (await this.prisma.profile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              status: true,
              role: true,
              subscriptions: { select: { plan: true, status: true } },
            },
          },
        },
      })) as unknown as
        | (Profile & {
            user: {
              status: string;
              role: string;
              subscriptions: { plan: string; status: string } | null;
            };
          })
        | null;
    } catch (error) {
      logger.error({ error, userId }, 'ProfileRepository: findProfileWithUser failed');
      throw new InternalError('Database operation failed', { userId });
    }
  }

  private calculateCompleteness(data: Record<string, unknown>): number {
    const filled = COMPLETENESS_FIELDS.filter((f) => {
      const val = data[f];
      return (
        val !== null &&
        val !== undefined &&
        (typeof val !== 'string' || (val as string).length > 0) &&
        (!Array.isArray(val) || (val as unknown[]).length > 0)
      );
    }).length;
    return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
  }
}
