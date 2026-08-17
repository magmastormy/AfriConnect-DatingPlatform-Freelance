import { ISettingsRepository } from './settings.repository';
import { UpdateSettingsInput, PlatformSettingsView } from './settings.types';
import { ValidationError } from '@africonnect/shared';

export interface ISettingsService {
  getSettings(): Promise<PlatformSettingsView>;
  updateSettings(input: UpdateSettingsInput, adminId: string): Promise<PlatformSettingsView>;
}

export class SettingsService implements ISettingsService {
  constructor(private readonly repo: ISettingsRepository) {}

  getSettings(): Promise<PlatformSettingsView> {
    return this.repo.getRow();
  }

  async updateSettings(input: UpdateSettingsInput, adminId: string): Promise<PlatformSettingsView> {
    const clean: Partial<PlatformSettingsView> = {};
    if (input.freeViewMaxExtraPhotos !== undefined) {
      clean.freeViewMaxExtraPhotos = input.freeViewMaxExtraPhotos;
    }
    if (input.freePremiumConnectionLimit !== undefined) {
      clean.freePremiumConnectionLimit = input.freePremiumConnectionLimit;
    }
    if (input.restrictedHiddenFields !== undefined) {
      clean.restrictedHiddenFields = input.restrictedHiddenFields;
    }
    if (Object.keys(clean).length === 0) {
      throw new ValidationError('No settings provided to update');
    }
    return this.repo.updateRow(clean, adminId);
  }
}
