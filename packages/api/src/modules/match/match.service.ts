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
  RecommendCard,
} from './match.types';
import { MatchingEngine, buildDefaultConfig } from './engine';
import { buildInteractionMatrix } from './collaborative';
import { EngineViewer, EngineCandidate } from './algorithms.types';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import {
  DAILY_MATCH_LIMIT,
  DISCOVER_PREVIEW_LIMIT,
  DEFAULT_MATCH_RADIUS_KM,
  MAX_MATCH_RADIUS_KM,
  RECOMMEND_TOP_N,
  CF_SAMPLE_SIZE,
  ELO_INITIAL,
} from '@africonnect/shared';
import { Gender, City, EducationLevel, MatchAction } from '@africonnect/shared';
import { getPlatformSettings } from '@modules/settings';

export interface IMatchService {
  generateDailyMatches(userId: string): Promise<{ matches: DailyMatchEntry[]; cached: boolean }>;
  expressInterest(
    userId: string,
    input: ExpressInterestInput,
  ): Promise<{ status: string; mutual: boolean; score?: number | null }>;
  getMutual(userId: string): Promise<unknown[]>;
  discover(userId: string, limit?: number): Promise<RecommendCard[]>;
  getPreview(limit?: number): Promise<DiscoverCard[]>;
  /** Full hybrid recommender (content + CF + diversity + business rules). */
  recommend(userId: string, opts?: { limit?: number; radiusKm?: number }): Promise<RecommendCard[]>;
}

/** Maps a Prisma Profile row into the scorer's MatchCandidate shape. */
function toCandidate(p: {
  userId: string;
  gender: string;
  city: string;
  educationLevel: string | null;
  dateOfBirth: Date | null;
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

    // Free-tier connection cap: a free+vetted member may hold at most
    // FREE_PREMIUM_CONNECTION_LIMIT mutual connections with premium+vetted
    // members. Unfriending frees a slot but the cap itself never drops — only a
    // Premium upgrade removes it.
    if (input.action !== MatchAction.Pass) {
      const [viewerTier, targetTier] = await Promise.all([
        this.repo.loadUserTier(userId),
        this.repo.loadUserTier(input.targetId),
      ]);
      const targetIsPremiumVetted = targetTier.isPremium && targetTier.isVetted;
      if (!viewerTier.isPremium && targetIsPremiumVetted) {
        // Cap is operator-tunable via the admin CRM (platform_settings).
        const settings = await getPlatformSettings();
        const used = await this.repo.countPremiumVettedConnections(userId);
        if (used >= settings.freePremiumConnectionLimit) {
          throw new ConflictError(
            `Free members can connect with up to ${settings.freePremiumConnectionLimit} Premium members. Upgrade to connect with more.`,
          );
        }
      }
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
    // Enrich each mutual match with the counterpart's profile so the web page
    // can render a name and photo instead of an opaque user id. The web client
    // calls /matches/mutual and renders these as cards.
    const counterpartIds = matches.map((m) => m.matchedUserId);
    const profiles = await this.profileRepo.findByUserIds(counterpartIds);
    const byUser = new Map(profiles.map((p) => [p.userId, p]));
    return matches.map((m) => {
      const profile = byUser.get(m.matchedUserId);
      return {
        id: m.id,
        userId: m.matchedUserId,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        name: profile?.displayName ?? profile?.firstName ?? 'Member',
        profession: profile?.profession ?? null,
        photo: Array.isArray(profile?.photos)
          ? (((profile!.photos as unknown[])[0] as { url?: string } | undefined)?.url ?? null)
          : null,
        city: profile?.city ?? null,
      };
    });
  }

  /**
   * Default discovery surface (GET /matches/discover).
   *
   * Migrated onto the hybrid MatchingEngine (breakdown §9 pipeline) — content
   * + collaborative filtering, cold-start fallback, popularity damping, business
   * rules, MMR diversity, fairness re-rank. Returns `RecommendCard` (a superset
   * of `DiscoverCard`) so existing web clients keep working while gaining the
   * richer explainability fields. No ML/AI involved.
   */
  async discover(userId: string, limit = 20): Promise<RecommendCard[]> {
    return this.runEngine(userId, { limit });
  }

  /**
   * Alias of `discover` that additionally accepts an explicit discovery radius.
   * Both endpoints are backed by the same engine; `/discover` is the canonical
   * (default) surface and `/recommend` is kept for callers that want to tune the
   * radius at request time.
   */
  async recommend(
    userId: string,
    opts: { limit?: number; radiusKm?: number } = {},
  ): Promise<RecommendCard[]> {
    return this.runEngine(userId, opts);
  }

  /**
   * Shared engine runner for `discover` and `recommend`. Loads the viewer, the
   * collaborative-filtering interaction sample, candidate metadata (Elo, age,
   * like-count) and the geo-filtered candidate pool, then delegates ranking to
   * the pure `MatchingEngine`. Returns `RecommendCard[]`.
   */
  private async runEngine(
    userId: string,
    opts: { limit?: number; radiusKm?: number } = {},
  ): Promise<RecommendCard[]> {
    const viewer = await this.profileRepo.findByUserId(userId);
    if (!viewer) throw new NotFoundError('Complete your profile before discovering');
    if (viewer.isPaused) throw new ValidationError('Your profile is currently paused');

    const prefs = (viewer.preferences as MatchPreferences) ?? {};
    const viewerDeal = (viewer as { dealbreakers?: string[] }).dealbreakers ?? [];
    const radiusKm = Math.min(
      MAX_MATCH_RADIUS_KM,
      Math.max(1, opts.radiusKm ?? prefs.distanceKm ?? DEFAULT_MATCH_RADIUS_KM),
    );
    const topN = Math.min(50, opts.limit ?? RECOMMEND_TOP_N);

    const [tier, accountCreatedAt, likedItemIds, interactions] = await Promise.all([
      this.repo.loadUserTier(userId),
      this.repo.loadAccountCreatedAt(userId),
      this.repo.getViewerLikes(userId),
      this.repo.getInteractionSample(CF_SAMPLE_SIZE),
    ]);
    const accountAgeDays = accountCreatedAt
      ? Math.max(0, Math.floor((Date.now() - accountCreatedAt.getTime()) / 86_400_000))
      : 0;

    const engineViewer: EngineViewer = {
      userId,
      preferences: prefs,
      dealbreakers: viewerDeal,
      latitude: (viewer as { latitude?: number | null }).latitude ?? null,
      longitude: (viewer as { longitude?: number | null }).longitude ?? null,
      city: viewer.city as City,
      isPremium: tier.isPremium,
      accountAgeDays,
      elo: ELO_INITIAL,
      likedItemIds,
    };

    const excludeIds = await this.repo.getExcludedIds(userId);
    const where: Prisma.ProfileWhereInput = {
      isPaused: false,
      isComplete: true,
      NOT: { userId: { in: excludeIds } },
      gender: prefs.genderPreference ?? undefined,
    };

    const candidates = await this.repo.findMatchableCandidates(where, {
      skip: 0,
      take: topN * 5, // over-fetch; geo radius + scoring narrow it down
    });
    if (candidates.length === 0) return [];

    const meta = await this.repo.getCandidateMeta(candidates.map((c) => c.userId));
    const profileById = new Map(candidates.map((c) => [c.userId, c]));
    const viewerInterests = prefs.interests ?? [];

    const engineCandidates: EngineCandidate[] = candidates.map((c) => {
      const m = meta.get(c.userId) ?? { accountAgeDays: 0, likedByCount: 0, elo: ELO_INITIAL };
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
        userId: c.userId,
        gender: c.gender as Gender,
        city: c.city as City,
        educationLevel: (c.educationLevel ?? 'bachelors') as EducationLevel,
        dateOfBirth: c.dateOfBirth,
        latitude: c.latitude ?? null,
        longitude: c.longitude ?? null,
        interests: c.interests ?? [],
        industries: c.industries ?? [],
        profession: c.profession ?? undefined,
        dealbreakers: c.dealbreakers ?? [],
        verified,
        isPremium,
        accountAgeDays: m.accountAgeDays,
        elo: m.elo,
        likedByCount: m.likedByCount,
      };
    });

    const matrix = buildInteractionMatrix(interactions);
    const engine = new MatchingEngine(buildDefaultConfig({ radiusKm, topN }));
    const ranked = engine.recommend(engineViewer, engineCandidates, matrix);

    return ranked.map((r) => {
      const c = r.candidate;
      const p = profileById.get(c.userId);
      const photos = Array.isArray(p?.photos)
        ? (p!.photos as { url: string }[]).map((ph) => ph.url).filter(Boolean)
        : [];
      const shared = (c.interests ?? []).filter((i) => viewerInterests.includes(i));
      return {
        userId: c.userId,
        displayName: p?.displayName ?? null,
        headline: p?.headline ?? null,
        city: c.city,
        educationLevel: c.educationLevel,
        profession: c.profession ?? null,
        employer: p?.employer ?? null,
        age: c.dateOfBirth ? ageFromDob(c.dateOfBirth) : 0,
        score: r.score,
        sharedInterests: shared,
        photos,
        verified: c.verified ?? false,
        isPremium: c.isPremium,
        distanceKm: r.distanceKm,
        contentScore: r.contentScore,
        cfScore: r.cfScore,
        coldStart: r.breakdown.coldStartFallback,
        breakdown: {
          base: r.breakdown.base,
          popularityAdjustment: r.breakdown.popularityAdjustment,
          premiumBoost: r.breakdown.premiumBoost,
          newUserBoost: r.breakdown.newUserBoost,
          diversityApplied: r.breakdown.diversityApplied,
          fairnessAdjusted: r.breakdown.fairnessAdjusted,
        },
      } as RecommendCard;
    });
  }

  /**
   * Unvetted members preview a small, capped sample of seeded (complete +
   * verified) members to encourage profile completion. Unlike `discover`, this
   * is NOT personalised by the viewer's preferences and is hard-capped at
   * DISCOVER_PREVIEW_LIMIT so an unverified account can never browse the full
   * discovery pool. The act of connecting remains gated by vetting elsewhere.
   */
  async getPreview(limit?: number): Promise<DiscoverCard[]> {
    const cap = Math.min(limit ?? DISCOVER_PREVIEW_LIMIT, DISCOVER_PREVIEW_LIMIT);

    const candidates = await this.repo.findMatchableCandidates(
      { isPaused: false, isComplete: true },
      { skip: 0, take: cap },
    );

    return candidates.map((c) => {
      const candidate = toCandidate(c);
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
        age: candidate.dateOfBirth ? ageFromDob(candidate.dateOfBirth) : 0,
        score: 0,
        sharedInterests: [],
        photos,
        verified,
        isPremium,
      } as DiscoverCard;
    });
  }
}
