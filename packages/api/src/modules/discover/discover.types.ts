import { City, EducationLevel } from '@africonnect/shared';

/** A member returned by the WeChat-Nearby discovery endpoint. */
export interface NearbyProfileView {
  userId: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  age: number;
  bio: string | null;
  headline: string | null;
  /** Up to PROFILE_MAX_PHOTOS (3) photo URLs — the Tinder-style "bio grid". */
  photos: string[];
  city: City;
  district: string | null;
  profession: string | null;
  employer: string | null;
  educationLevel: EducationLevel | null;
  isPremium: boolean;
  verified: boolean;
}

export interface GetNearbyQuery {
  city?: City;
  district?: string;
  limit?: number;
}
