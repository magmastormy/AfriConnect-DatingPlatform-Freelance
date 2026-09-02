import { z } from 'zod';
import {
  Gender,
  EducationLevel,
  RelationshipGoal,
  City,
  ApplicationStatus,
} from '@africonnect/shared';
import { config } from '@config/index';

/** Field definitions shared by the real product and the prototype build. */
const applicationShape = {
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
};

/**
 * Real-product rules: the full professional dossier is mandatory and the
 * applicant must back their career with LinkedIn or an uploaded artifact. This
 * is what makes "verified professional" mean something on AfriConnect.
 */
export const fullApplicationSchema = z
  .object(applicationShape)
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

/**
 * Prototype rules. The reviewer only needs to experience the verification
 * journey — "upload your documents, you're verified" — so the professional
 * dossier becomes optional. The service substitutes an explicit placeholder
 * rather than inventing details, so it is always clear what was really
 * submitted. Identity documents stay mandatory in both modes.
 */
export const prototypeApplicationSchema = z.object({
  ...applicationShape,
  nationality: applicationShape.nationality.optional(),
  profession: applicationShape.profession.optional(),
  employer: applicationShape.employer.optional(),
  educationLevel: applicationShape.educationLevel.optional(),
  institution: applicationShape.institution.optional(),
  city: applicationShape.city.optional(),
  // Gender is intentionally not collected during the trimmed prototype
  // onboarding (only name, DOB and a photo are required). It stays optional here
  // and the service substitutes a placeholder so the NOT NULL column is satisfied.
  gender: applicationShape.gender.optional(),
});

/**
 * Resolves the schema for the current build. Prototype mode relaxes the dossier
 * requirements; PROTOTYPE_MODE=false restores every production rule.
 */
export function getCreateApplicationSchema() {
  return config.prototypeMode ? prototypeApplicationSchema : fullApplicationSchema;
}

/**
 * Mode-resolved application schema, frozen at module load. Kept as a static
 * export for the test suite, which asserts the production (PROTOTYPE_MODE=false)
 * rules — run tests with PROTOTYPE_MODE=false so this resolves to the full schema.
 */
export const createApplicationSchema = getCreateApplicationSchema();

export const reviewApplicationSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  adminNotes: z.string().max(2000).optional(),
});

export type CreateApplicationDTO = z.infer<typeof fullApplicationSchema>;
export type ReviewApplicationDTO = z.infer<typeof reviewApplicationSchema>;
