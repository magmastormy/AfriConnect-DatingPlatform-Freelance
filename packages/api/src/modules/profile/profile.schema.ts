import { z } from 'zod';
import { Gender, EducationLevel, City, BIO_MAX_LENGTH } from '@africonnect/shared';

export const createProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.nativeEnum(Gender),
  city: z.nativeEnum(City),
  bio: z.string().max(BIO_MAX_LENGTH).optional(),
  profession: z.string().max(120).optional(),
  employer: z.string().max(120).optional(),
  educationLevel: z.nativeEnum(EducationLevel).optional(),
  institution: z.string().max(160).optional(),
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

export type CreateProfileDTO = z.infer<typeof createProfileSchema>;
export type UpdatePreferencesDTO = z.infer<typeof updatePreferencesSchema>;
export type UpdatePrivacyDTO = z.infer<typeof updatePrivacySchema>;
export type AddPhotoDTO = z.infer<typeof addPhotoSchema>;
