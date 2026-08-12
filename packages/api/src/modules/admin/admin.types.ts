import {
  UserRole,
  UserStatus,
  ApplicationStatus,
  AdminScope,
  SubscriptionStatus,
  SubscriptionPlan,
  City,
} from '@africonnect/shared';

/** Top-level operational dashboard for any administrator. */
export interface AdminDashboard {
  applicationsPending: number;
  applicationsUnderReview: number;
  membersActive: number;
  membersSuspended: number;
  eventsPublished: number;
  eventsDraft: number;
  revenueZar: number;
  mrrZar: number;
  subscriptionsActive: number;
}

/** A member/account as seen by an admin. */
export interface MemberView {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  firstName?: string | null;
  lastName?: string | null;
  city?: City | null;
  isComplete?: boolean | null;
}

export interface MemberDetail extends MemberView {
  profile: unknown | null;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
  } | null;
  applications: { id: string; status: ApplicationStatus; createdAt: Date }[];
}

export interface ApplicationAdminView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: City;
  profession: string;
  status: ApplicationStatus;
  createdAt: Date;
  reviewedBy: string | null;
}

export interface SubscriptionAdminView {
  userId: string;
  email: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}

export interface AdminAuditView {
  id: string;
  adminId: string;
  action: string;
  entity: string;
  entityId: string | null;
  scope: AdminScope;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

export interface RoleAssignment {
  userId: string;
  role: UserRole;
}

/** Describes a role and which scopes it grants — surfaced to SuperAdmins. */
export interface RoleDescriptor {
  role: UserRole;
  label: string;
  scopes: AdminScope[];
}
