/**
 * Membership stages and capability gating.
 *
 * The product rule: a member creates an account first (Clerk), gets a working
 * but LIMITED experience immediately, and only then goes through vetting.
 * Profile editing is always available so they can tune their profile while
 * their application is pending; the social surfaces stay locked until a human
 * vetting decision lands.
 *
 * Stage is derived from the backend AuthUser (role + status), never stored
 * client-side, so a tampered browser cannot unlock a capability. Every gated
 * endpoint is independently enforced server-side by requireVetted() — this
 * module exists to render honest UI, not to be the security boundary.
 */

import { UserRole, UserStatus, SubscriptionPlan, SubscriptionStatus } from '@/lib/shared';
import type { AuthUser } from '@/lib/auth';

export enum MembershipStage {
  /** Signed in, has not submitted an application yet. */
  Unvetted = 'unvetted',
  /** Application submitted, awaiting a vetting decision. */
  PendingReview = 'pending_review',
  /** Approved by vetting. Full access. */
  Verified = 'verified',
  /** Suspended or banned. Read-only, cannot act. */
  Restricted = 'restricted',
}

/** Capabilities the UI can ask about. */
export enum Capability {
  /** Create and edit own profile, photos, preferences. Always on. */
  EditProfile = 'edit_profile',
  /** Submit or resubmit a vetting application. */
  SubmitApplication = 'submit_application',
  /** Browse the discovery deck. */
  Discover = 'discover',
  /** Like / pass / superlike, and see daily introductions. */
  Match = 'match',
  /** Open conversations and send messages. */
  Message = 'message',
  /** RSVP to events and see attendees. */
  AttendEvents = 'attend_events',
  /** See a preview of who is on the platform, without acting. */
  PreviewMembers = 'preview_members',
}

/**
 * Capabilities granted at each stage. Unvetted and PendingReview are
 * deliberately identical except for the ability to submit an application:
 * a pending applicant should not be able to submit a second one.
 */
const STAGE_CAPABILITIES: Record<MembershipStage, Capability[]> = {
  [MembershipStage.Unvetted]: [
    Capability.EditProfile,
    Capability.SubmitApplication,
    Capability.PreviewMembers,
  ],
  [MembershipStage.PendingReview]: [Capability.EditProfile, Capability.PreviewMembers],
  [MembershipStage.Verified]: [
    Capability.EditProfile,
    Capability.Discover,
    Capability.Match,
    Capability.Message,
    Capability.AttendEvents,
    Capability.PreviewMembers,
  ],
  [MembershipStage.Restricted]: [],
};

/**
 * Derives the membership stage.
 *
 * `applicationStatus` comes from GET /applications/me and is optional: when it
 * has not loaded yet we fall back to role/status alone, which errs toward
 * Unvetted (the more restricted reading).
 */
export function membershipStage(
  user: AuthUser | null,
  applicationStatus?: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'on_hold' | null,
): MembershipStage {
  if (!user) return MembershipStage.Unvetted;

  if (user.status === UserStatus.Suspended || user.status === UserStatus.Banned) {
    return MembershipStage.Restricted;
  }

  // An active member/premium account is the post-approval state: vetting sets
  // role=member and status=active on approval.
  const memberRole = user.role === UserRole.Member || user.role === UserRole.Premium;
  if (memberRole && user.status === UserStatus.Active) return MembershipStage.Verified;

  if (applicationStatus === 'approved') return MembershipStage.Verified;
  if (applicationStatus === 'submitted' || applicationStatus === 'under_review') {
    return MembershipStage.PendingReview;
  }
  // 'rejected' and 'on_hold' return to Unvetted so the member can act again
  // (reapply / supply more documents).
  return MembershipStage.Unvetted;
}

export function can(stage: MembershipStage, capability: Capability): boolean {
  return STAGE_CAPABILITIES[stage].includes(capability);
}

// ── Subscription-derived membership helpers (Change C) ───────────────────────

/** The minimal subscription view the account page already fetches. */
export interface SubscriptionView {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

/** A member is premium with an active premium OR platinum plan. */
export function isPremium(sub: SubscriptionView | null | undefined): boolean {
  return (
    Boolean(sub) &&
    (sub!.plan === SubscriptionPlan.Premium || sub!.plan === SubscriptionPlan.Platinum) &&
    sub!.status === SubscriptionStatus.Active
  );
}

export function tierLabel(sub: SubscriptionView | null | undefined): string {
  if (!sub) return 'Free member';
  if (sub.plan === SubscriptionPlan.Platinum && sub.status === SubscriptionStatus.Active) {
    return 'Platinum member';
  }
  return isPremium(sub) ? 'Premium member' : 'Free member';
}

export function expiryLabel(sub: SubscriptionView | null | undefined): string {
  if (!sub || !sub.currentPeriodEnd) return 'No active plan';
  const d = new Date(sub.currentPeriodEnd);
  if (Number.isNaN(d.getTime())) return 'No active plan';
  return `Renews ${d.toLocaleDateString()}`;
}

/** Human-readable stage label for badges and banners. */
export function stageLabel(stage: MembershipStage): string {
  switch (stage) {
    case MembershipStage.Verified:
      return 'Verified member';
    case MembershipStage.PendingReview:
      return 'Vetting in review';
    case MembershipStage.Restricted:
      return 'Account restricted';
    default:
      return 'Not yet vetted';
  }
}
