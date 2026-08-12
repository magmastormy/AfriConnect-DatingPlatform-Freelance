import { Prisma } from '@prisma/client';
import { IMatchRepository } from './match.repository';
import { IProfileRepository } from '@modules/profile/profile.repository';
import { scoreCompatibility, applyPenalties, passesThreshold, ageFromDob } from './scoring';
import {
  ExpressInterestInput,
  MatchPreferences,
  MatchCandidate,
  DailyMatchEntry,
  DiscoverCard,
} from './match.types';
import { ValidationError, ConflictError, NotFoundError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import { DAILY_MATCH_LIMIT } from '@africonnect/shared';
import { Gender, City, EducationLevel, MatchAction } from '@africonnect/shared';

export interface IMatchService {
  generateDailyMatches(userId: string): Promise<{ matches: DailyMatchEntry[]; cached: boolean }>;
  expressInterest(
    userId: string,
    input: ExpressInterestInput,
  ): Promise<{ status: string; mutual: boolean; score?: number | null }>;
  getMutual(userId: string): Promise<unknown[]>;
  discover(userId: string, limit?: number): Promise<DiscoverCard[]>;
}

/** Maps a Prisma Profile row into the scorer's MatchCandidate shape. */
function toCandidate(p: {
  userId: string;
  gender: string;
  city: string;
  educationLevel: string | null;
  dateOfBirth: Date;
  profession: string | null;
  interests: string[];
  preferences: unknown;
  dealbreakers?: string[];
  verified?: boolean;
}): MatchCandidate {
  const prefs = (p.preferences as { relationshipGoals?: string; interests?: string[] }) ?? {};
  return {
    userId: p.userId,
    gender: p.gender as Gender,
    city: p.city as City,
    educationLevel: (p.educationLevel ?? 'bachelors') as EducationLevel,
    dateOfBirth: p.dateOfBirth,
    profession: p.profession ?? undefined,
    interests: p.interests ?? [],
    relationshipGoals:
      (prefs.relationshipGoals as MatchCandidate['relationshipGoals']) ?? undefined,
    dealbreakers: p.dealbreakers ?? [],
    verified: p.verified,
  };
}

function dobForAge(age: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d;
}

export class MatchService implements IMatchService {
  constructor(
    private readonly repo: IMatchRepository,
    private readonly profileRepo: IProfileRepository,
  ) {}

  async generateDailyMatches(
    userId: string,
  ): Promise<{ matches: DailyMatchEntry[]; cached: boolean }> {
    const cached = await this.repo.findTodaysQueue(userId);
    if (cached) return { matches: cached.matches, cached: true };

    const viewer = await this.profileRepo.findByUserId(userId);
    if (!viewer) throw new NotFoundError('Complete your profile before viewing matches');
    if (!viewer.isComplete) {
      throw new ValidationError('Complete your profile before viewing matches');
    }
    if (viewer.isPaused) throw new ValidationError('Your profile is currently paused');

    const prefs = (viewer.preferences as MatchPreferences) ?? {};

    // Build the query window from the viewer's preferences.
    const minAgeDob = prefs.ageMax ? dobForAge(prefs.ageMax) : undefined;
    const maxAgeDob = prefs.ageMin ? dobForAge(prefs.ageMin) : undefined;

    const excludeIds = await this.repo.getExcludedIds(userId);

    const where: Prisma.ProfileWhereInput = {
      isPaused: false,
      isComplete: true,
      NOT: { userId: { in: excludeIds } },
      gender: prefs.genderPreference ?? undefined,
      city: prefs.city ?? undefined,
      // Education is a soft preference — scored per-candidate rather than hard
      // filtered here (Prisma enum columns don't support range comparisons).
      ...(minAgeDob || maxAgeDob ? { dateOfBirth: { gte: minAgeDob, lte: maxAgeDob } } : {}),
    };

    const candidates = await this.repo.findMatchableCandidates(where, {
      skip: 0,
      take: DAILY_MATCH_LIMIT * 4, // over-fetch so scoring can rank down to the limit
    });

    const viewerPrefs: MatchPreferences = { ...prefs, interests: prefs.interests ?? [] };
    const scored = candidates
      .map((c) => {
        const candidate = toCandidate(c);
        const base = scoreCompatibility({ preferences: viewerPrefs }, candidate);
        // Passed/blocked are already excluded via excludeIds; penalties kept for
        // future soft-filters (e.g. previously viewed). No-op today.
        const final = applyPenalties(base, {});
        return { candidate, score: final };
      })
      .filter((s) => passesThreshold(s.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, DAILY_MATCH_LIMIT);

    const entries: DailyMatchEntry[] = scored.map(({ candidate, score }) => ({
      userId: candidate.userId,
      score,
      displayName: null,
      city: candidate.city,
      educationLevel: candidate.educationLevel,
      profession: candidate.profession ?? null,
    }));

    await this.repo.createDailyQueue(userId, entries);
    logger.info({ userId, generated: entries.length }, 'Daily matches generated');
    return { matches: entries, cached: false };
  }

  async expressInterest(
    userId: string,
    input: ExpressInterestInput,
  ): Promise<{ status: string; mutual: boolean; score?: number | null }> {
    if (userId === input.targetId) {
      throw new ValidationError('Cannot match with yourself');
    }
    const existing = await this.repo.findActionBetween(userId, input.targetId);
    if (existing?.status === 'mutual') {
      throw new ConflictError('You are already matched with this user');
    }

    // Carry the most recent daily-compatibility score onto the action record.
    const queue = await this.repo.findTodaysQueue(userId);
    const score = queue?.matches.find((m) => m.userId === input.targetId)?.score ?? null;

    // Map the API enum to the repository's persisted action string.
    const action =
      input.action === MatchAction.SuperLike
        ? 'superliked'
        : input.action === MatchAction.Pass
          ? 'passed'
          : 'liked';
    const result = await this.repo.upsertAction(userId, input.targetId, action, score);
    const mutual = result.status === 'mutual';
    if (mutual) {
      logger.info({ userId, targetId: input.targetId }, 'Mutual match created');
    }
    return { status: result.status, mutual, score: result.compatibilityScore };
  }

  async getMutual(userId: string): Promise<unknown[]> {
    const matches = await this.repo.findMutual(userId);
    if (!matches.length) return [];
    return matches;
  }

  async discover(userId: string, limit = 20): Promise<DiscoverCard[]> {
    const viewer = await this.profileRepo.findByUserId(userId);
    if (!viewer) throw new NotFoundError('Complete your profile before discovering');
    if (viewer.isPaused) throw new ValidationError('Your profile is currently paused');

    const prefs = (viewer.preferences as MatchPreferences) ?? {};
    const viewerInterests = prefs.interests ?? [];
    const viewerDeal = (viewer as { dealbreakers?: string[] }).dealbreakers ?? [];

    const excludeIds = await this.repo.getExcludedIds(userId);
    const where: Prisma.ProfileWhereInput = {
      isPaused: false,
      isComplete: true,
      NOT: { userId: { in: excludeIds } },
      gender: prefs.genderPreference ?? undefined,
      city: prefs.city ?? undefined,
    };

    const candidates = await this.repo.findMatchableCandidates(where, {
      skip: 0,
      take: limit * 3,
    });

    const viewerPrefs: MatchPreferences = { ...prefs, interests: viewerInterests };
    return candidates
      .map((c) => {
        const candidate = toCandidate(c);
        const base = scoreCompatibility(
          { preferences: viewerPrefs, dealbreakers: viewerDeal },
          candidate,
        );
        const final = applyPenalties(base, {});
        const shared = (candidate.interests ?? []).filter((i) => viewerInterests.includes(i));
        const photos = Array.isArray(c.photos)
          ? (c.photos as { url: string }[]).map((p) => p.url).filter(Boolean)
          : [];
        const user = (
          c as {
            user?: {
              emailVerified: boolean;
              phoneVerified: boolean;
              subscriptions?: { plan: string } | null;
            };
          }
        ).user;
        const verified = Boolean(user?.emailVerified && user?.phoneVerified);
        const isPremium = Boolean(user?.subscriptions?.plan && user.subscriptions.plan !== 'free');
        return {
          userId: candidate.userId,
          displayName: c.displayName ?? null,
          headline: (c as { headline?: string | null }).headline ?? null,
          city: candidate.city,
          educationLevel: candidate.educationLevel,
          profession: candidate.profession ?? null,
          employer: (c as { employer?: string | null }).employer ?? null,
          age: ageFromDob(candidate.dateOfBirth),
          score: final,
          sharedInterests: shared,
          photos,
          verified,
          isPremium,
        } as DiscoverCard;
      })
      .filter((card) => passesThreshold(card.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
