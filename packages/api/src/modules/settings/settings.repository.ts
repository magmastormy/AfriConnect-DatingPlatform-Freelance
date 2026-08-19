import { prisma } from '@config/prisma';
import { redisGetJson, redisSetJson } from '@config/redis';
import { PlatformSettingsView } from './settings.types';

const DEFAULT_VIEW: PlatformSettingsView = {
  freeViewMaxExtraPhotos: 1,
  freePremiumConnectionLimit: 5,
  restrictedHiddenFields: ['nationality', 'profession', 'educationLevel', 'dateOfBirth'],
};

const CACHE_KEY = 'settings:platform';
const CACHE_TTL_SECONDS = 30;

export interface ISettingsRepository {
  getRow(): Promise<PlatformSettingsView>;
  updateRow(input: Partial<PlatformSettingsView>, updatedBy: string): Promise<PlatformSettingsView>;
}

type SettingsRow = {
  freeViewMaxExtraPhotos: number;
  freePremiumConnectionLimit: number;
  restrictedHiddenFields: string[];
};

function mapRow(row: SettingsRow): PlatformSettingsView {
  return {
    freeViewMaxExtraPhotos: row.freeViewMaxExtraPhotos,
    freePremiumConnectionLimit: row.freePremiumConnectionLimit,
    restrictedHiddenFields: row.restrictedHiddenFields,
  };
}

export class SettingsRepository implements ISettingsRepository {
  constructor(private readonly db = prisma) {}

  async getRow(): Promise<PlatformSettingsView> {
    // Shared (Redis) cache so an admin settings change propagates to every
    // instance within the TTL instead of being stale on instances that never
    // re-read the row. Falls back to the in-memory backbone when Redis is unset.
    const cached = await redisGetJson<PlatformSettingsView>(CACHE_KEY);
    if (cached) return cached;
    try {
      const row = (await this.db.platformSettings.findUnique({
        where: { id: 1 },
      })) as SettingsRow | null;
      const value = row ? mapRow(row) : DEFAULT_VIEW;
      await redisSetJson(CACHE_KEY, value, CACHE_TTL_SECONDS);
      return value;
    } catch {
      // Table not migrated yet or DB unreachable — fall back to sane defaults so
      // gating still works (using the shared-constant values) instead of crashing.
      return DEFAULT_VIEW;
    }
  }

  async updateRow(
    input: Partial<PlatformSettingsView>,
    updatedBy: string,
  ): Promise<PlatformSettingsView> {
    const row = (await this.db.platformSettings.update({
      where: { id: 1 },
      data: { ...input, updatedBy },
    })) as SettingsRow;
    const value = mapRow(row);
    await redisSetJson(CACHE_KEY, value, CACHE_TTL_SECONDS);
    return value;
  }
}

let singleton: SettingsRepository | null = null;

/**
 * Cached reader usable by other modules (profile/match gating) without a
 * per-request DB hit. Falls back to defaults if the table is unreachable.
 */
export async function getPlatformSettings(): Promise<PlatformSettingsView> {
  if (!singleton) singleton = new SettingsRepository();
  return singleton.getRow();
}
