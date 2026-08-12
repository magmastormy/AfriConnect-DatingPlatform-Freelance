import { Gender, EducationLevel, City } from '@africonnect/shared';

export interface ProfilePhoto {
  url: string;
  order: number;
  isPrimary: boolean;
}

export interface CreateProfileInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  city: City;
  bio?: string;
  profession?: string;
  employer?: string;
  educationLevel?: EducationLevel;
  institution?: string;
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
