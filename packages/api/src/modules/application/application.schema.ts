import { z } from 'zod';
import {
  Gender,
  EducationLevel,
  RelationshipGoal,
  City,
  ApplicationStatus,
} from '@africonnect/shared';

export const createApplicationSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().optional(),
    phone: z.string().min(8).max(20).optional(),
    dateOfBirth: z
      .string()
      .datetime()
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .transform((val) => new Date(val)),
    gender: z.nativeEnum(Gender),
    nationality: z.string().min(2).max(60),
    profession: z.string().min(1).max(120),
    employer: z.string().min(1).max(120),
    linkedInUrl: z.string().url().optional(),
    educationLevel: z.nativeEnum(EducationLevel),
    institution: z.string().min(1).max(160),
    relationshipGoals: z.nativeEnum(RelationshipGoal).optional(),
    city: z.nativeEnum(City),
    idDocumentUrl: z.string().min(1),
    degreeCertificateUrl: z.string().min(1).optional(),
    selfieUrl: z.string().min(1),
    proofOfWorkUrl: z.string().min(1).optional(),
    proofOfWorkType: z.enum(['resume', 'work_badge', 'selfie_company', 'linkedin']).optional(),
  })
  .refine((v) => Boolean(v.linkedInUrl) || Boolean(v.proofOfWorkUrl), {
    message: 'Provide a LinkedIn URL or a proof-of-work upload',
    path: ['linkedInUrl'],
  })
  .refine(
    (v) => {
      if (!v.proofOfWorkType) return true;
      if (v.proofOfWorkType === 'linkedin') return Boolean(v.linkedInUrl);
      return Boolean(v.proofOfWorkUrl);
    },
    {
      message: 'The chosen proof-of-work method must match the supplied artifact',
      path: ['proofOfWorkType'],
    },
  );

export const reviewApplicationSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  adminNotes: z.string().max(2000).optional(),
});

export type CreateApplicationDTO = z.infer<typeof createApplicationSchema>;
export type ReviewApplicationDTO = z.infer<typeof reviewApplicationSchema>;
