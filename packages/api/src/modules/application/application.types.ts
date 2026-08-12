import {
  ApplicationStatus,
  Gender,
  EducationLevel,
  RelationshipGoal,
  City,
} from '@africonnect/shared';

export interface CreateApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string; // ISO date
  gender: Gender;
  nationality: string;
  profession: string;
  employer: string;
  linkedInUrl: string;
  educationLevel: EducationLevel;
  institution: string;
  relationshipGoals: RelationshipGoal;
  city: City;
  idDocumentUrl: string;
  degreeCertificateUrl: string;
  selfieUrl: string;
}

export interface ReviewApplicationInput {
  status: ApplicationStatus;
  adminNotes?: string;
}

export interface ApplicationView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: City;
  profession: string;
  status: ApplicationStatus;
  createdAt: Date;
}
