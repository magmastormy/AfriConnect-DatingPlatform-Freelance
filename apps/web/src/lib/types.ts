import type {
  UserRole,
  UserStatus,
  ApplicationStatus,
  Gender,
  City,
  EducationLevel,
  RelationshipGoal,
  SubscriptionPlan,
  SubscriptionStatus,
  EventStatus,
  EventType,
} from '@/lib/shared';

export type {
  UserRole,
  UserStatus,
  ApplicationStatus,
  Gender,
  City,
  EducationLevel,
  RelationshipGoal,
  SubscriptionPlan,
  SubscriptionStatus,
  EventStatus,
  EventType,
};

export interface DailyMatch {
  userId: string;
  score: number;
  displayName: string | null;
  city: City;
  educationLevel: EducationLevel;
  profession: string | null;
}

export interface DiscoverCard {
  userId: string;
  displayName: string | null;
  headline: string | null;
  city: City;
  educationLevel: EducationLevel | null;
  profession: string | null;
  employer: string | null;
  age: number;
  score: number;
  sharedInterests: string[];
  photos: string[];
  verified: boolean;
  isPremium: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  status: string;
  isEdited: boolean;
  editedAt: string | null;
  isDeleted: boolean;
  recalledAt: string | null;
  createdAt: string;
}

export interface ApplicationView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: City;
  profession: string;
  status: ApplicationStatus;
  createdAt: string;
  reviewedBy: string | null;
}

export interface MemberView {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  firstName?: string | null;
  lastName?: string | null;
  city?: City | null;
  isComplete?: boolean | null;
}

export interface SubscriptionAdminView {
  userId: string;
  email: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  channel: string;
  isRead: boolean;
  createdAt: string;
  /** In-app destination; renders as a CTA button in the notification bell. */
  link?: string;
}

export interface SearchApplicationHit {
  id: string;
  firstName: string;
  lastName: string;
  status: ApplicationStatus;
  createdAt: string;
}

export interface SearchSubscriptionHit {
  userId: string;
  email: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
}

export interface GlobalSearchResult {
  members: MemberView[];
  applications: SearchApplicationHit[];
  subscriptions: SearchSubscriptionHit[];
}

export interface EventView {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  city: City;
  venueName: string;
  startTime: string;
  endTime: string;
  capacity: number;
  ticketPrice: number;
  status: EventStatus;
  featured: boolean;
}

/** A member returned by the WeChat-Nearby (district-scoped, premium) endpoint. */
export interface NearbyProfileView {
  userId: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  age: number;
  bio: string | null;
  headline: string | null;
  photos: string[];
  city: City;
  district: string | null;
  profession: string | null;
  employer: string | null;
  educationLevel: EducationLevel | null;
  isPremium: boolean;
  verified: boolean;
}

/** RedNote-style drill-down card returned by GET /profile/:userId (tier-gated). */
export interface ProfileRedNoteView {
  userId: string;
  fullName: string;
  displayName: string | null;
  location: { city: City; district: string | null };
  nationality: string | null;
  profession: string | null;
  industry: string[];
  educationLevel: EducationLevel | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  bio: string | null;
  headline: string | null;
  photos: string[];
  isPremium: boolean;
  verified: boolean;
  /** True when a free+vetted viewer is inspecting a premium+vetted member. */
  restricted: boolean;
}

/** Vetting application as seen by an admin reviewer. */
export interface ApplicationAdminView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  nationality: string;
  gender: Gender;
  dateOfBirth: string;
  city: City;
  profession: string;
  employer: string;
  educationLevel: EducationLevel;
  institution: string;
  linkedInUrl?: string;
  proofOfWorkType?: string;
  proofOfWorkUrl?: string;
  idDocumentUrl: string;
  selfieUrl: string;
  degreeCertificateUrl?: string;
  status: ApplicationStatus;
  createdAt: string;
  reviewedBy: string | null;
}

export interface MutualMatch {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
  name: string;
  profession: string | null;
  photo: string | null;
  city: string | null;
}

export interface ConversationView {
  id: string;
  participantName: string;
  lastMessage: string;
  unread: boolean;
  updatedAt: string;
}

export interface MessageView {
  id: string;
  senderId: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface RoleDescriptor {
  role: UserRole;
  label: string;
  scopes: string[];
}

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

// ── Platform settings (admin CRM) ─────────────────────────────────────────────
export interface PlatformSettingsView {
  freeViewMaxExtraPhotos: number;
  freePremiumConnectionLimit: number;
  restrictedHiddenFields: string[];
}

export interface UpdateSettingsInput {
  freeViewMaxExtraPhotos?: number;
  freePremiumConnectionLimit?: number;
  restrictedHiddenFields?: string[];
}

// Server-only admin view types. Mirrors packages/api/src/modules/admin/admin.types.ts —
// these are not shared via @africonnect/shared because the web app is the only consumer.
export interface MemberDetail extends MemberView {
  profile: unknown | null;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
  } | null;
  applications: { id: string; status: ApplicationStatus; createdAt: string }[];
}

export interface AdminAuditView {
  id: string;
  adminId: string;
  action: string;
  entity: string;
  entityId: string | null;
  scope: string;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
}
