import { z } from 'zod';
import {
  Gender,
  EducationLevel,
  RelationshipGoal,
  City,
  ApplicationStatus,
} from '@africonnect/shared';

export const createApplicationSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  dateOfBirth: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  gender: z.nativeEnum(Gender),
  nationality: z.string().min(2).max(60),
  profession: z.string().min(1).max(120),
  employer: z.string().min(1).max(120),
  linkedInUrl: z.string().url(),
  educationLevel: z.nativeEnum(EducationLevel),
  institution: z.string().min(1).max(160),
  relationshipGoals: z.nativeEnum(RelationshipGoal),
  city: z.nativeEnum(City),
  idDocumentUrl: z.string().min(1),
  degreeCertificateUrl: z.string().min(1),
  selfieUrl: z.string().min(1),
});

export const reviewApplicationSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  adminNotes: z.string().max(2000).optional(),
});

export type CreateApplicationDTO = z.infer<typeof createApplicationSchema>;
export type ReviewApplicationDTO = z.infer<typeof reviewApplicationSchema>;
