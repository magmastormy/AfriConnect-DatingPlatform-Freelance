import { z } from 'zod';
import { Gender, EducationLevel, City, BIO_MAX_LENGTH } from '@africonnect/shared';

export const createProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  // dateOfBirth is optional so the account page can save a partial profile
  // (name/city/gender/bio) without forcing a full DOB capture on first edit.
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  gender: z.nativeEnum(Gender),
  city: z.nativeEnum(City),
  nationality: z.string().min(2).max(60).optional(),
  bio: z.string().max(BIO_MAX_LENGTH).optional(),
  profession: z.string().max(120).optional(),
  employer: z.string().max(120).optional(),
  educationLevel: z.nativeEnum(EducationLevel).optional(),
  institution: z.string().max(160).optional(),
  industries: z.array(z.string().min(1).max(60)).max(20).optional(),
  interests: z.array(z.string()).max(20).optional(),
  dealbreakers: z.array(z.string()).max(20).optional(),
});

export const updatePreferencesSchema = z.object({
  ageMin: z.number().int().min(18).max(80).optional(),
  ageMax: z.number().int().min(18).max(80).optional(),
  distanceKm: z.number().int().min(0).max(5000).optional(),
  educationMin: z.nativeEnum(EducationLevel).optional(),
  professions: z.array(z.string()).max(20).optional(),
  relationshipGoals: z.array(z.string()).max(10).optional(),
});

export const updatePrivacySchema = z.object({
  showEmployer: z.boolean().optional(),
  showAge: z.boolean().optional(),
  photoVisibility: z.enum(['all', 'matches', 'none']).optional(),
});

export const addPhotoSchema = z.object({
  url: z.string().min(1),
  isPrimary: z.boolean().optional(),
});

export const updateNearbySchema = z.object({
  district: z.string().min(1).max(80).optional(),
  nearbyEnabled: z.boolean().optional(),
  // Precise geolocation from the browser. Persisted when opting in, cleared
  // (set null) when the member drops their location.
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type CreateProfileDTO = z.infer<typeof createProfileSchema>;

// Partial profile edits from the account page. Account-first onboarding means a
// member may tune their profile incrementally (and before vetting), so every
// field is optional here — the controller merges onto the existing row rather
// than requiring a full payload on each save.
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().max(100).nullable().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  gender: z.nativeEnum(Gender).optional(),
  city: z.nativeEnum(City).optional(),
  nationality: z.string().min(2).max(60).optional(),
  bio: z.string().max(BIO_MAX_LENGTH).optional(),
  profession: z.string().max(120).optional(),
  employer: z.string().max(120).optional(),
  educationLevel: z.nativeEnum(EducationLevel).optional(),
  institution: z.string().max(160).optional(),
  industries: z.array(z.string().min(1).max(60)).max(20).optional(),
  interests: z.array(z.string()).max(20).optional(),
  dealbreakers: z.array(z.string()).max(20).optional(),
});

export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesDTO = z.infer<typeof updatePreferencesSchema>;
export type UpdatePrivacyDTO = z.infer<typeof updatePrivacySchema>;
export type AddPhotoDTO = z.infer<typeof addPhotoSchema>;
export type UpdateNearbyDTO = z.infer<typeof updateNearbySchema>;
