import { IProfileRepository, tierFromUser } from './profile.repository';
import {
  UpdateProfileInput,
  UpdatePreferencesInput,
  UpdatePrivacyInput,
  UpdateNearbyInput,
  ProfileRedNoteView,
} from './profile.types';
import { NotFoundError, ValidationError } from '@africonnect/shared';
import { PROFILE_MAX_PHOTOS, City, EducationLevel, Gender } from '@africonnect/shared';
import { getPlatformSettings } from '@modules/settings';
import { logger } from '@africonnect/shared';

export interface IProfileService {
  getOwn(userId: string): Promise<Record<string, unknown>>;
  upsert(userId: string, input: UpdateProfileInput): Promise<Record<string, unknown>>;
  updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<Record<string, unknown>>;
  updatePrivacy(userId: string, input: UpdatePrivacyInput): Promise<Record<string, unknown>>;
  addPhoto(userId: string, url: string, isPrimary?: boolean): Promise<Record<string, unknown>>;
  removePhoto(userId: string, url: string): Promise<Record<string, unknown>>;
  updateNearby(userId: string, input: UpdateNearbyInput): Promise<Record<string, unknown>>;
  pause(userId: string, paused: boolean): Promise<Record<string, unknown>>;
  getRedNote(viewerId: string, targetId: string): Promise<ProfileRedNoteView>;
}

export class ProfileService implements IProfileService {
  constructor(private readonly repo: IProfileRepository) {}

  async getOwn(userId: string): Promise<Record<string, unknown>> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) {
      // Return a minimal profile structure for new users who haven't created a profile yet
      return {
        firstName: '',
        lastName: '',
        city: '',
        profession: null,
        bio: '',
        dateOfBirth: null,
        isComplete: false,
        isPaused: false,
        photos: [],
      };
    }
    return profile;
  }

  async upsert(userId: string, input: UpdateProfileInput): Promise<Record<string, unknown>> {
    if (input.bio && input.bio.length > 500) {
      throw new ValidationError('Bio exceeds 500 characters');
    }
    const existing = await this.repo.findByUserId(userId);
    // Account-first onboarding lets a member save a partial profile, but gender
    // and city remain required for any newly-created row. Surface a clear
    // validation error instead of letting Prisma throw a NOT NULL 500.
    if (!existing && (!input.gender || !input.city)) {
      throw new ValidationError('Gender and city are required to create your profile');
    }
    const data: Record<string, unknown> = {
      ...input,
      photos: existing?.photos ?? [],
    };
    // Preserve an existing date of birth when the caller omits it (partial
    // edits from the account page don't resend DOB).
    if (input.dateOfBirth) data.dateOfBirth = new Date(input.dateOfBirth);
    else if (existing?.dateOfBirth) data.dateOfBirth = existing.dateOfBirth;
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

  async updateNearby(userId: string, input: UpdateNearbyInput): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByUserId(userId);
    if (!existing) throw new NotFoundError('Profile not found', { userId });
    const data: {
      district?: string | null;
      nearbyEnabled?: boolean;
      latitude?: number | null;
      longitude?: number | null;
    } = {};
    if (input.district !== undefined) data.district = input.district;
    if (input.nearbyEnabled !== undefined) data.nearbyEnabled = input.nearbyEnabled;
    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;
    if (Object.keys(data).length === 0) return existing;
    return this.repo.updateNearby(userId, data);
  }

  async getRedNote(viewerId: string, targetId: string): Promise<ProfileRedNoteView> {
    if (viewerId === targetId) {
      throw new ValidationError('You cannot open your own RedNote card here');
    }
    const [viewer, target] = await Promise.all([
      this.repo.findProfileWithUser(viewerId),
      this.repo.findProfileWithUser(targetId),
    ]);
    if (!target) throw new NotFoundError('Profile not found', { userId: targetId });

    const viewerTier = viewer ? tierFromUser(viewer.user) : { isPremium: false, isVetted: false };
    const targetTier = tierFromUser(target.user);
    // Free+vetted inspecting a premium+vetted member => restricted field set.
    const restricted = !viewerTier.isPremium && targetTier.isPremium && targetTier.isVetted;

    // Gating knobs are operator-tunable via the admin CRM (platform_settings).
    const settings = await getPlatformSettings();
    const hidden = new Set(settings.restrictedHiddenFields);
    const hide = (field: string) => restricted && hidden.has(field);

    const photosRaw = Array.isArray(target.photos)
      ? ((target.photos as Array<{ url: string }>).map((p) => p.url).filter(Boolean) as string[])
      : [];
    // The profile pic (photos[0]) is always shown. A restricted viewer may see
    // at most `freeViewMaxExtraPhotos` additional gallery images on top of it.
    const heroCount = 1;
    const extraCap = restricted
      ? settings.freeViewMaxExtraPhotos
      : Math.max(0, PROFILE_MAX_PHOTOS - heroCount);
    const photos = photosRaw.slice(0, heroCount + extraCap);

    return {
      userId: target.userId,
      fullName: `${target.firstName} ${target.lastName}`.trim(),
      displayName: target.displayName ?? null,
      location: { city: target.city as City, district: target.district },
      nationality: hide('nationality') ? null : (target.nationality ?? null),
      profession: hide('profession') ? null : (target.profession ?? null),
      industry: (target.industries as string[]) ?? [],
      educationLevel: hide('educationLevel')
        ? null
        : ((target.educationLevel as EducationLevel) ?? null),
      gender: (target.gender as Gender) ?? null,
      dateOfBirth: hide('dateOfBirth') ? null : (target.dateOfBirth?.toISOString() ?? null),
      bio: target.bio ?? null,
      headline: target.headline ?? null,
      photos,
      isPremium: targetTier.isPremium,
      verified: targetTier.isVetted,
      restricted,
    };
  }
}
