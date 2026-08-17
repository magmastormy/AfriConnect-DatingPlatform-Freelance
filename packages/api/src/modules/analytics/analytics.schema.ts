import { z } from 'zod';
import { ANALYTICS_WINDOWS, ANALYTICS_DEFAULT_WINDOW } from '@africonnect/shared';

/** POST /analytics/profile-view body. */
export const profileViewSchema = z.object({
  viewedUserId: z.string().min(1),
});

export type ProfileViewDTO = z.infer<typeof profileViewSchema>;

/** GET /analytics/me?window=… — coerces string query to a valid window. */
export const analyticsWindowSchema = z.object({
  window: z.preprocess(
    (v) => (v == null || v === '' ? ANALYTICS_DEFAULT_WINDOW : Number(v)),
    z.number().refine((w) => (ANALYTICS_WINDOWS as readonly number[]).includes(w), {
      message: 'window must be 7, 30, or 90',
    }),
  ),
});

export type AnalyticsWindowDTO = z.infer<typeof analyticsWindowSchema>;
