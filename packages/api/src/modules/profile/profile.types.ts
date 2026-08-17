import { Gender, EducationLevel, City } from '@africonnect/shared';

/** RedNote-style profile card returned on drill-down from a Tinder/match card. */
export interface ProfileRedNoteView {
  userId: string;
  fullName: string;
  displayName: string | null;
  location: { city: City; district: string | null };
  nationality: string | null;
  profession: string | null;
  industry: string[];
  educationLevel: EducationLevel | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  bio: string | null;
  headline: string | null;
  photos: string[];
  isPremium: boolean;
  verified: boolean;
  /**
   * True when a free+vetted viewer is inspecting a premium+vetted member. In
   * that case education, DOB, exact profession are withheld and extra photos are
   * capped (industry + gender remain visible).
   */
  restricted: boolean;
}

export interface ProfilePhoto {
  url: string;
  order: number;
  isPrimary: boolean;
}

export interface CreateProfileInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender: Gender;
  city: City;
  nationality?: string;
  bio?: string;
  profession?: string;
  employer?: string;
  educationLevel?: EducationLevel;
  institution?: string;
  industries?: string[];
  interests?: string[];
  dealbreakers?: string[];
}

/** Partial profile edit accepted by PUT /profile/me (account-first onboarding). */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  dateOfBirth?: string;
  gender?: Gender;
  city?: City;
  nationality?: string;
  bio?: string;
  profession?: string;
  employer?: string;
  educationLevel?: EducationLevel;
  institution?: string;
  industries?: string[];
  interests?: string[];
  dealbreakers?: string[];
}

export interface UpdatePreferencesInput {
  ageMin?: number;
  ageMax?: number;
  distanceKm?: number;
  educationMin?: EducationLevel;
  professions?: string[];
  relationshipGoals?: string[];
}

export interface UpdatePrivacyInput {
  showEmployer?: boolean;
  showAge?: boolean;
  photoVisibility?: 'all' | 'matches' | 'none';
}

export interface UpdateNearbyInput {
  district?: string;
  nearbyEnabled?: boolean;
  latitude?: number;
  longitude?: number;
}
