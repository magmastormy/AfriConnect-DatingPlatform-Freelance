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
} from '@africonnect/shared';

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
