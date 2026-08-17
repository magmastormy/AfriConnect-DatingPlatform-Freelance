import { z } from 'zod';
import { GATED_FIELDS } from './settings.types';

/** Body for PUT /settings — every field optional (partial update). */
export const updateSettingsSchema = z
  .object({
    freeViewMaxExtraPhotos: z.number().int().min(0).max(10).optional(),
    freePremiumConnectionLimit: z.number().int().min(1).max(100).optional(),
    restrictedHiddenFields: z.array(z.enum(GATED_FIELDS)).optional(),
  })
  .strict();
