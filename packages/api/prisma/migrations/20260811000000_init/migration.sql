-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('applicant', 'member', 'premium', 'admin', 'admin_vetting', 'admin_events', 'admin_billing', 'admin_support', 'admin_content', 'superadmin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending', 'active', 'suspended', 'banned');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'non_binary', 'other');

-- CreateEnum
CREATE TYPE "City" AS ENUM ('johannesburg', 'cape_town', 'pietermaritzburg', 'durban', 'pretoria');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('diploma', 'bachelors', 'honours', 'masters', 'phd', 'professional');

-- CreateEnum
CREATE TYPE "RelationshipGoal" AS ENUM ('marriage', 'long_term', 'companionship', 'friendship');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('submitted', 'under_review', 'approved', 'rejected', 'on_hold');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('pending', 'liked', 'passed', 'mutual', 'unmatched');

-- CreateEnum
CREATE TYPE "MatchAction" AS ENUM ('liked', 'passed', 'superliked');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('wine_dine', 'mixer', 'themed', 'gala');

-- CreateEnum
CREATE TYPE "RSVPStatus" AS ENUM ('confirmed', 'waitlist', 'cancelled', 'attended', 'no_show');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('digital_access', 'premium', 'platinum');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'sms', 'push', 'in_app');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('sent', 'delivered', 'read');

-- CreateEnum
CREATE TYPE "AdminScope" AS ENUM ('vetting', 'events', 'billing', 'support', 'content', 'super');

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'applicant',
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "clerkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceInfo" JSONB,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vetting_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "nationality" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "employer" TEXT NOT NULL,
    "linkedInUrl" TEXT NOT NULL,
    "educationLevel" "EducationLevel" NOT NULL,
    "institution" TEXT NOT NULL,
    "relationshipGoals" "RelationshipGoal" NOT NULL,
    "city" "City" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'submitted',
    "adminNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "idDocumentUrl" TEXT NOT NULL,
    "degreeCertificateUrl" TEXT NOT NULL,
    "selfieUrl" TEXT NOT NULL,

    CONSTRAINT "vetting_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "city" "City" NOT NULL,
    "bio" TEXT,
    "headline" TEXT,
    "profession" TEXT,
    "employer" TEXT,
    "heightCm" INTEGER,
    "educationLevel" "EducationLevel",
    "institution" TEXT,
    "interests" TEXT[],
    "dealbreakers" TEXT[],
    "photos" JSONB,
    "preferences" JSONB,
    "privacy" JSONB,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "completenessScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_matches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchedUserId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'pending',
    "compatibilityScore" INTEGER,
    "userAction" "MatchAction",
    "matchedUserAction" "MatchAction",
    "matchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_daily_queues" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matches" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_daily_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "participant1Id" TEXT NOT NULL,
    "participant2Id" TEXT NOT NULL,
    "lastMessageId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "unreadCountP1" INTEGER NOT NULL DEFAULT 0,
    "unreadCountP2" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'sent',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "recalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "city" "City" NOT NULL,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT NOT NULL,
    "venueMapUrl" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "ticketPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dressCode" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RSVPStatus" NOT NULL DEFAULT 'confirmed',
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_stars" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "starerId" TEXT NOT NULL,
    "starreeId" TEXT NOT NULL,
    "isMutual" BOOLEAN NOT NULL DEFAULT false,
    "revealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_stars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "eventId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "stripePaymentIntentId" TEXT,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "channel" "NotificationChannel" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notify_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" JSONB,
    "sms" JSONB,
    "push" JSONB,
    "inApp" JSONB,

    CONSTRAINT "notify_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "scope" "AdminScope" NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_phone_key" ON "auth_users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_clerkId_key" ON "auth_users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "auth_sessions"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_jti_key" ON "auth_sessions"("jti");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "vetting_applications_status_idx" ON "vetting_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "profile_profiles_userId_key" ON "profile_profiles"("userId");

-- CreateIndex
CREATE INDEX "profile_profiles_city_idx" ON "profile_profiles"("city");

-- CreateIndex
CREATE INDEX "profile_profiles_gender_idx" ON "profile_profiles"("gender");

-- CreateIndex
CREATE INDEX "profile_profiles_educationLevel_idx" ON "profile_profiles"("educationLevel");

-- CreateIndex
CREATE INDEX "profile_profiles_isPaused_isComplete_idx" ON "profile_profiles"("isPaused", "isComplete");

-- CreateIndex
CREATE INDEX "match_matches_userId_status_idx" ON "match_matches"("userId", "status");

-- CreateIndex
CREATE INDEX "match_matches_userId_matchedUserId_status_idx" ON "match_matches"("userId", "matchedUserId", "status");

-- CreateIndex
CREATE INDEX "match_daily_queues_userId_idx" ON "match_daily_queues"("userId");

-- CreateIndex
CREATE INDEX "chat_conversations_participant1Id_idx" ON "chat_conversations"("participant1Id");

-- CreateIndex
CREATE INDEX "chat_conversations_participant2Id_idx" ON "chat_conversations"("participant2Id");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "event_events_city_status_idx" ON "event_events"("city", "status");

-- CreateIndex
CREATE INDEX "event_rsvps_eventId_status_idx" ON "event_rsvps"("eventId", "status");

-- CreateIndex
CREATE INDEX "event_rsvps_userId_idx" ON "event_rsvps"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_rsvps_eventId_userId_key" ON "event_rsvps"("eventId", "userId");

-- CreateIndex
CREATE INDEX "event_stars_eventId_starerId_idx" ON "event_stars"("eventId", "starerId");

-- CreateIndex
CREATE UNIQUE INDEX "event_stars_eventId_starerId_starreeId_key" ON "event_stars"("eventId", "starerId", "starreeId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_userId_key" ON "billing_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "billing_payments_userId_idx" ON "billing_payments"("userId");

-- CreateIndex
CREATE INDEX "notify_notifications_userId_isRead_idx" ON "notify_notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "notify_preferences_userId_key" ON "notify_preferences"("userId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_idx" ON "admin_audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_entity_entityId_idx" ON "admin_audit_logs"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vetting_applications" ADD CONSTRAINT "vetting_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_profiles" ADD CONSTRAINT "profile_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_matches" ADD CONSTRAINT "match_matches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_matches" ADD CONSTRAINT "match_matches_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_daily_queues" ADD CONSTRAINT "match_daily_queues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_participant1Id_fkey" FOREIGN KEY ("participant1Id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_participant2Id_fkey" FOREIGN KEY ("participant2Id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_stars" ADD CONSTRAINT "event_stars_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_stars" ADD CONSTRAINT "event_stars_starerId_fkey" FOREIGN KEY ("starerId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_stars" ADD CONSTRAINT "event_stars_starreeId_fkey" FOREIGN KEY ("starreeId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_notifications" ADD CONSTRAINT "notify_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_preferences" ADD CONSTRAINT "notify_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

