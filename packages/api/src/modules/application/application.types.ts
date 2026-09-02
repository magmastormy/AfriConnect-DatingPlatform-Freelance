import {
  ApplicationStatus,
  Gender,
  EducationLevel,
  RelationshipGoal,
  City,
  ProofOfWorkType,
  Nationality,
} from '@africonnect/shared';

export interface CreateApplicationInput {
  firstName: string;
  lastName: string;
  // Email/phone are optional in the 2-step flow: when omitted they are derived
  // from the authenticated account (see ApplicationRepository.getUserContact).
  email?: string;
  phone?: string;
  dateOfBirth: Date; // Date object (transformed from string by schema)
  // Optional in the prototype build (the trimmed onboarding omits it); the
  // service substitutes a neutral placeholder so the NOT NULL column is satisfied.
  gender?: Gender;
  // ── Professional dossier ──────────────────────────────────────────────────
  // Required in the real product, but optional here because the prototype build
  // lets a reviewer get verified on identity documents alone. When absent the
  // service persists an explicit placeholder rather than inventing details.
  nationality?: string;
  profession?: string;
  employer?: string;
  // LinkedIn is now optional — proof-of-work upload is an alternative (Change B).
  linkedInUrl?: string;
  educationLevel?: EducationLevel;
  institution?: string;
  relationshipGoals?: RelationshipGoal;
  city?: City;
  idDocumentUrl: string;
  // Degree certificate is no longer mandatory (Change B).
  degreeCertificateUrl?: string;
  selfieUrl: string;
  // NEW (Change B): proof-of-work upload, alternative to LinkedIn.
  proofOfWorkUrl?: string;
  // Which proof-of-work method the applicant chose (resume|work_badge|
  // selfie_company|linkedin). Drives which artifact above is required.
  proofOfWorkType?: ProofOfWorkType;
}

export interface ReviewApplicationInput {
  status: ApplicationStatus;
  adminNotes?: string;
}

export interface ApplicationView {
  id: string;
  firstName: string;
  lastName: string;
  email: string; // PII-encrypted at rest; reviewers see ciphertext by design
  nationality: Nationality | string;
  gender: Gender;
  dateOfBirth: Date;
  city: City;
  profession: string;
  employer: string;
  educationLevel: EducationLevel;
  institution: string;
  linkedInUrl?: string;
  proofOfWorkType?: ProofOfWorkType;
  proofOfWorkUrl?: string;
  idDocumentUrl: string;
  selfieUrl: string;
  degreeCertificateUrl?: string;
  status: ApplicationStatus;
  createdAt: Date;
  reviewedBy: string | null;
}
