/**
 * Domain enums shared across all modules (AGENTS.md Clause 1/2 — packages/shared).
 * Declared as TS `enum` to interoperate with Zod's `z.nativeEnum` and allow
 * `.Value` member access. At Prisma repository boundaries we cast Prisma's
 * generated `$Enums` to these via `asEnum` (identical runtime values).
 */

export enum UserRole {
  Applicant = 'applicant',
  Member = 'member',
  Premium = 'premium',
  Admin = 'admin',
  AdminVetting = 'admin_vetting',
  AdminEvents = 'admin_events',
  AdminBilling = 'admin_billing',
  AdminSupport = 'admin_support',
  AdminContent = 'admin_content',
  SuperAdmin = 'superadmin',
}

/**
 * Administrative scopes. Each scope is owned by one or more roles so the
 * platform can be run by specialists (a vetting admin cannot touch billing).
 * `Admin` is the generalist that holds every non-super scope; `SuperAdmin`
 * additionally owns role/permission management.
 */
export enum AdminScope {
  Vetting = 'vetting',
  Events = 'events',
  Billing = 'billing',
  Support = 'support',
  Content = 'content',
  Super = 'super',
}

/** Roles that are allowed to act within each admin scope. */
export const SCOPE_ROLES: Record<AdminScope, UserRole[]> = {
  [AdminScope.Vetting]: [UserRole.AdminVetting, UserRole.Admin, UserRole.SuperAdmin],
  [AdminScope.Events]: [UserRole.AdminEvents, UserRole.Admin, UserRole.SuperAdmin],
  [AdminScope.Billing]: [UserRole.AdminBilling, UserRole.Admin, UserRole.SuperAdmin],
  [AdminScope.Support]: [UserRole.AdminSupport, UserRole.Admin, UserRole.SuperAdmin],
  [AdminScope.Content]: [UserRole.AdminContent, UserRole.Admin, UserRole.SuperAdmin],
  [AdminScope.Super]: [UserRole.SuperAdmin],
};

/** Every role that is some form of administrator (used for listing/seed). */
export const ADMIN_ROLES: UserRole[] = [
  UserRole.Admin,
  UserRole.AdminVetting,
  UserRole.AdminEvents,
  UserRole.AdminBilling,
  UserRole.AdminSupport,
  UserRole.AdminContent,
  UserRole.SuperAdmin,
];

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export enum UserStatus {
  Pending = 'pending',
  Active = 'active',
  Suspended = 'suspended',
  Banned = 'banned',
}

export enum Gender {
  Male = 'male',
  Female = 'female',
  NonBinary = 'non_binary',
  Other = 'other',
}

export enum City {
  Johannesburg = 'johannesburg',
  CapeTown = 'cape_town',
  Pietermaritzburg = 'pietermaritzburg',
  Durban = 'durban',
  Pretoria = 'pretoria',
}

export enum EducationLevel {
  Diploma = 'diploma',
  Bachelors = 'bachelors',
  Honours = 'honours',
  Masters = 'masters',
  PhD = 'phd',
  Professional = 'professional',
}

export enum RelationshipGoal {
  Marriage = 'marriage',
  LongTerm = 'long_term',
  Companionship = 'companionship',
  Friendship = 'friendship',
}

export enum ApplicationStatus {
  Submitted = 'submitted',
  UnderReview = 'under_review',
  Approved = 'approved',
  Rejected = 'rejected',
  OnHold = 'on_hold',
}

export enum MatchStatus {
  Pending = 'pending',
  Liked = 'liked',
  Passed = 'passed',
  Mutual = 'mutual',
  Unmatched = 'unmatched',
}

export enum MatchAction {
  Like = 'liked',
  Pass = 'passed',
  SuperLike = 'superliked',
}

export enum EventStatus {
  Draft = 'draft',
  Pending = 'pending',
  Published = 'published',
  Cancelled = 'cancelled',
  Completed = 'completed',
}

export enum EventType {
  WineDine = 'wine_dine',
  Mixer = 'mixer',
  Themed = 'themed',
  Gala = 'gala',
}

export enum RSVPStatus {
  Confirmed = 'confirmed',
  Waitlist = 'waitlist',
  Cancelled = 'cancelled',
  Attended = 'attended',
  NoShow = 'no_show',
}

export enum SubscriptionPlan {
  Digital = 'digital_access',
  Premium = 'premium',
  Platinum = 'platinum',
}

export enum SubscriptionStatus {
  Trialing = 'trialing',
  Active = 'active',
  PastDue = 'past_due',
  Cancelled = 'cancelled',
  Expired = 'expired',
}

export enum PaymentStatus {
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Refunded = 'refunded',
}

export enum NotificationChannel {
  Email = 'email',
  Sms = 'sms',
  Push = 'push',
  InApp = 'in_app',
}

export enum MessageStatus {
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
}

/**
 * Casts a Prisma-generated enum value to the shared enum. Both share identical
 * string values, so this is a safe nominal bridge at repository boundaries.
 */
export function asEnum<T>(value: unknown): T {
  return value as T;
}

/** Lightweight authenticated principal attached to the request by auth middleware. */
export interface AuthedUser {
  userId: string;
  role: UserRole;
  email: string;
  status: UserStatus;
}
