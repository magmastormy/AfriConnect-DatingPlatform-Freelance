import { z } from 'zod';
import { City } from '@africonnect/shared';

export const nearbyQuerySchema = z.object({
  city: z.nativeEnum(City).optional(),
  district: z.string().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type NearbyQueryDTO = z.infer<typeof nearbyQuerySchema>;
