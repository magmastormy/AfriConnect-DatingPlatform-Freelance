import { EventType, City, RSVPStatus } from '@africonnect/shared';

export interface CreateEventInput {
  title: string;
  description: string;
  eventType: EventType;
  city: City;
  venueName: string;
  venueAddress: string;
  venueMapUrl?: string;
  startTime: string;
  endTime: string;
  capacity: number;
  ticketPrice: number;
  dressCode?: string;
}

export interface RSVPResult {
  status: RSVPStatus;
  waitlisted: boolean;
}
