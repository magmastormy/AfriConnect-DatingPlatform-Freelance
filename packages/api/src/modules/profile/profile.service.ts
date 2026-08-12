import { IProfileRepository } from './profile.repository';
import { CreateProfileInput, UpdatePreferencesInput, UpdatePrivacyInput } from './profile.types';
import { NotFoundError, ValidationError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';

export interface IProfileService {
  getOwn(userId: string): Promise<Record<string, unknown>>;
  upsert(userId: string, input: CreateProfileInput): Promise<Record<string, unknown>>;
  updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<Record<string, unknown>>;
  updatePrivacy(userId: string, input: UpdatePrivacyInput): Promise<Record<string, unknown>>;
  addPhoto(userId: string, url: string, isPrimary?: boolean): Promise<Record<string, unknown>>;
  removePhoto(userId: string, url: string): Promise<Record<string, unknown>>;
  pause(userId: string, paused: boolean): Promise<Record<string, unknown>>;
}

export class ProfileService implements IProfileService {
  constructor(private readonly repo: IProfileRepository) {}

  async getOwn(userId: string): Promise<Record<string, unknown>> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) throw new NotFoundError('Profile not found', { userId });
    return profile;
  }

  async upsert(userId: string, input: CreateProfileInput): Promise<Record<string, unknown>> {
    if (input.bio && input.bio.length > 500) {
      throw new ValidationError('Bio exceeds 500 characters');
    }
    const existing = await this.repo.findByUserId(userId);
    const data = {
      ...input,
      dateOfBirth: new Date(input.dateOfBirth),
      photos: existing?.photos ?? [],
    };
    return existing ? this.repo.update(userId, data) : this.repo.create(userId, data);
  }

  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByUserId(userId);
    if (!existing) throw new NotFoundError('Profile not found', { userId });
    const preferences = { ...(existing.preferences as object), ...input };
    return this.repo.update(userId, { preferences });
  }

  async updatePrivacy(userId: string, input: UpdatePrivacyInput): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByUserId(userId);
    if (!existing) throw new NotFoundError('Profile not found', { userId });
    const privacy = { ...(existing.privacy as object), ...input };
    return this.repo.update(userId, { privacy });
  }

  async addPhoto(userId: string, url: string, isPrimary = false): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByUserId(userId);
    if (!existing) throw new NotFoundError('Profile not found', { userId });
    const photos = Array.isArray(existing.photos) ? (existing.photos as object[]) : [];
    const order = photos.length + 1;
    return this.repo.addPhoto(userId, { url, order, isPrimary });
  }

  async removePhoto(userId: string, url: string): Promise<Record<string, unknown>> {
    return this.repo.removePhoto(userId, url);
  }

  async pause(userId: string, paused: boolean): Promise<Record<string, unknown>> {
    logger.info({ userId, paused }, 'Profile pause toggled');
    return this.repo.setPaused(userId, paused);
  }
}
