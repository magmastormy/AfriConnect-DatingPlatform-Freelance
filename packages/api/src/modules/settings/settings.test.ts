import { SettingsService } from './settings.service';
import { ISettingsRepository } from './settings.repository';
import { ValidationError } from '@africonnect/shared';

function fakeRepo(over: Partial<ISettingsRepository> = {}): ISettingsRepository {
  const base: ISettingsRepository = {
    getRow: async () => ({
      freeViewMaxExtraPhotos: 1,
      freePremiumConnectionLimit: 5,
      restrictedHiddenFields: ['nationality', 'profession', 'educationLevel', 'dateOfBirth'],
    }),
    updateRow: async (input) => ({
      freeViewMaxExtraPhotos: input.freeViewMaxExtraPhotos ?? 1,
      freePremiumConnectionLimit: input.freePremiumConnectionLimit ?? 5,
      restrictedHiddenFields: input.restrictedHiddenFields ?? ['nationality'],
    }),
    ...over,
  };
  return base;
}

describe('SettingsService', () => {
  it('getSettings returns the repository view', async () => {
    const svc = new SettingsService(fakeRepo());
    const v = await svc.getSettings();
    expect(v.freePremiumConnectionLimit).toBe(5);
    expect(v.restrictedHiddenFields).toContain('nationality');
  });

  it('updateSettings passes through provided fields', async () => {
    const svc = new SettingsService(fakeRepo());
    const v = await svc.updateSettings({ freePremiumConnectionLimit: 10 }, 'admin1');
    expect(v.freePremiumConnectionLimit).toBe(10);
  });

  it('updateSettings with restrictedHiddenFields persists the set', async () => {
    const svc = new SettingsService(fakeRepo());
    const v = await svc.updateSettings(
      { restrictedHiddenFields: ['profession', 'dateOfBirth'] },
      'admin1',
    );
    expect(v.restrictedHiddenFields).toEqual(['profession', 'dateOfBirth']);
  });

  it('updateSettings throws ValidationError when no fields provided', async () => {
    const svc = new SettingsService(fakeRepo());
    await expect(svc.updateSettings({}, 'admin1')).rejects.toBeInstanceOf(ValidationError);
  });
});
