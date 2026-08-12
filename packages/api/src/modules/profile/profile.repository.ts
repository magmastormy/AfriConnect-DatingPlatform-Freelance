import { Prisma, PrismaClient, Profile } from '@prisma/client';
import { NotFoundError, ConflictError, InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import { PROFILE_MAX_PHOTOS } from '@africonnect/shared';

export interface IProfileRepository {
  findByUserId(userId: string): Promise<Profile | null>;
  create(userId: string, data: Record<string, unknown>): Promise<Profile>;
  update(userId: string, data: Record<string, unknown>): Promise<Profile>;
  addPhoto(
    userId: string,
    photo: { url: string; order: number; isPrimary: boolean },
  ): Promise<Profile>;
  removePhoto(userId: string, url: string): Promise<Profile>;
  setPaused(userId: string, paused: boolean): Promise<Profile>;
  findMatches(criteria: unknown, pagination: { skip: number; take: number }): Promise<Profile[]>;
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
