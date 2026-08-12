import { z } from 'zod';
import { EventType, EventStatus, City } from '@africonnect/shared';

export const createEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  eventType: z.nativeEnum(EventType),
  city: z.nativeEnum(City),
  venueName: z.string().min(1).max(200),
  venueAddress: z.string().min(1).max(300),
  venueMapUrl: z.string().url().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  capacity: z.number().int().min(1).max(1000),
  ticketPrice: z.number().min(0).max(100000),
  dressCode: z.string().max(200).optional(),
});

export const updateEventSchema = createEventSchema.partial().extend({
  status: z.nativeEnum(EventStatus).optional(),
});

export type CreateEventDTO = z.infer<typeof createEventSchema>;
export type UpdateEventDTO = z.infer<typeof updateEventSchema>;
