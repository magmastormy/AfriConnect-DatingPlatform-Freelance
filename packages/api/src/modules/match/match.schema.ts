import { z } from 'zod';
import { MatchAction } from '@africonnect/shared';

export const expressInterestSchema = z.object({
  targetId: z.string().min(1, 'Target user id required'),
  action: z.nativeEnum(MatchAction),
});

export type ExpressInterestDTO = z.infer<typeof expressInterestSchema>;
