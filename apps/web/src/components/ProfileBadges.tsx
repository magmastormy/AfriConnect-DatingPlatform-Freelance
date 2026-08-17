'use client';

import { Badge } from '@/components/ui';
import {
  MembershipStage,
  isPremium,
  tierLabel,
  expiryLabel,
  type SubscriptionView,
} from '@/lib/membership';
import type { ApplicationStatus } from '@/lib/shared';

interface Props {
  sub: SubscriptionView | null;
  stage: MembershipStage;
  applicationStatus: ApplicationStatus | null;
}

/**
 * Renders the membership badges: tier (free / premium), vetting state, the
 * membership expiry, and any outstanding application decision.
 */
export function ProfileBadges({ sub, stage, applicationStatus }: Props) {
  const premium = isPremium(sub);
  const vetted = stage === MembershipStage.Verified;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge tone={premium ? 'warn' : 'neutral'}>{tierLabel(sub)}</Badge>
      <Badge tone={vetted ? 'good' : 'bad'}>{vetted ? 'Vetted' : 'Not vetted'}</Badge>
      <Badge tone="neutral">{expiryLabel(sub)}</Badge>
      {stage === MembershipStage.PendingReview && <Badge tone="warn">Vetting in review</Badge>}
      {(applicationStatus === 'rejected' || applicationStatus === 'on_hold') && (
        <Badge tone="bad">Application {applicationStatus.replace('_', ' ')}</Badge>
      )}
    </div>
  );
}
