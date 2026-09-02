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
  SuperlikeReceived,
} from './match.types';
import { MatchingEngine, buildDefaultConfig } from './engine';
import { buildInteractionMatrix } from './collaborative';
import { EngineViewer, EngineCandidate } from './algorithms.types';
import { haversineKm } from './geo';
import {
  ValidationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from '@africonnect/shared';
import { logger, NotificationChannel } from '@africonnect/shared';
import type { INotificationService } from '@modules/notification/notification.service';
import { redisGetJson, redisSetJson } from '../../config/redis';
import { config } from '@config/index';
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

/** Opt-in Discover filters. All fields optional — the matching engine still
 *  ranks the result; these only narrow the candidate pool up front. */
export interface DiscoverQuery {
  city?: City;
  ageMin?: number;
  ageMax?: number;
  /** Require at least one overlapping interest (OR semantics). */
  interests?: string[];
  limit?: number;
}

export interface IMatchService {
  generateDailyMatches(userId: string): Promise<{ matches: DailyMatchEntry[]; cached: boolean }>;
  expressInterest(
    userId: string,
    input: ExpressInterestInput,
  ): Promise<{ status: string; mutual: boolean; score?: number | null; matchId: string }>;
  /** True when the two users are in a mutual match (used by chat for auth). */
  isMutual(a: string, b: string): Promise<boolean>;
  /** Pending superlikes the caller has RECEIVED (anonymous until mutual). */
  getSuperlikesReceived(userId: string): Promise<{ items: SuperlikeReceived[]; count: number }>;
  getMutual(userId: string): Promise<unknown[]>;
  /**
   * Opt-in Discover filters (all optional — the engine still drives ranking).
   * Kept deliberately narrow: city, age band, and shared interests. Education /
   * verified / premium are intentionally excluded to avoid a "filter everyone
   * out" dead-end and to keep the pool broad for new members.
   */
  discover(userId: string, opts?: DiscoverQuery): Promise<RecommendCard[]>;
  getPreview(limit?: number, excludeUserId?: string): Promise<DiscoverCard[]>;
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
    private readonly notify?: INotificationService,
  ) {}

  async generateDailyMatches(
    userId: string,
  ): Promise<{ matches: DailyMatchEntry[]; cached: boolean }> {
    const cached = await this.repo.findTodaysQueue(userId);
    if (cached) return { matches: cached.matches, cached: true };

    const viewer = await this.profileRepo.findByUserId(userId);
    if (!viewer) throw new NotFoundError('Complete your profile before viewing matches');
    // Prototype: onboarding is trimmed to the essentials (name, DOB, photo) and
    // the remainder is completed later in Settings, so the 80% completeness bar
    // would lock every reviewer out of discovery. Enforce it in the real product
    // only. The soft signal (completeness %) still drives ranking below.
    if (!viewer.isComplete && !config.prototypeMode) {
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
      take: DAILY_MATCH_LIMIT * 10, // over-fetch so scoring can rank down to the limit
    });

    // Enrich candidates with photo + distance so daily-match cards carry a face
    // and a proximity cue (mirrors the discover feed). The web client renders
    // these richer fields; a raw queue row previously rendered faceless cards.
    const enriched = await this.profileRepo.findByUserIds(candidates.map((c) => c.userId));
    const byUser = new Map(enriched.map((p) => [p.userId, p]));
    const viewerLat = viewer.latitude ?? null;
    const viewerLon = viewer.longitude ?? null;

    const viewerPrefs: MatchPreferences = { ...prefs, interests: prefs.interests ?? [] };
    const allScored = candidates
      .map((c) => {
        const candidate = toCandidate(c);
        const base = scoreCompatibility({ preferences: viewerPrefs }, candidate);
        // Passed/blocked are already excluded via excludeIds; penalties kept for
        // future soft-filters (e.g. previously viewed). No-op today.
        const final = applyPenalties(base, {});
        return { candidate, score: final };
      })
      .sort((a, b) => b.score - a.score);

    // Apply threshold — but fall back to top-N if every candidate scores below
    // it (e.g. very sparse user prefs or a small member pool). This ensures the
    // daily queue always has candidates rather than returning empty.
    const aboveThreshold = allScored.filter((s) => passesThreshold(s.score));
    const scored = (aboveThreshold.length > 0 ? aboveThreshold : allScored).slice(
      0,
      DAILY_MATCH_LIMIT,
    );

    const entries: DailyMatchEntry[] = scored.map(({ candidate, score }) => {
      const profile = byUser.get(candidate.userId);
      const photo = Array.isArray(profile?.photos)
        ? (((profile!.photos as unknown[])[0] as { url?: string } | undefined)?.url ?? null)
        : null;
      const distanceKm = haversineKm(
        { latitude: viewerLat, longitude: viewerLon },
        { latitude: profile?.latitude ?? null, longitude: profile?.longitude ?? null },
      );
      return {
        userId: candidate.userId,
        score,
        displayName: profile?.displayName ?? null,
        city: candidate.city,
        educationLevel: candidate.educationLevel,
        profession: candidate.profession ?? null,
        photo,
        distanceKm,
      };
    });

    await this.repo.createDailyQueue(userId, entries);
    logger.info({ userId, generated: entries.length }, 'Daily matches generated');
    return { matches: entries, cached: false };
  }

  async expressInterest(
    userId: string,
    input: ExpressInterestInput,
  ): Promise<{ status: string; mutual: boolean; score?: number | null; matchId: string }> {
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
      await this.fireMutualNotifications(userId, input.targetId);
    } else if (input.action === MatchAction.SuperLike && this.notify) {
      // Recipient gets an anonymous heads-up. POPIA: no sender identity is
      // carried in the title/body until the match becomes mutual.
      await this.notify.create({
        userId: input.targetId,
        type: 'superlike_received',
        title: 'Someone superliked you',
        body: 'A member thinks you stand out. Like them back to match.',
        channel: NotificationChannel.InApp,
        link: '/portal/matches?tab=daily',
      });
    }

    return {
      status: result.status,
      mutual,
      score: result.compatibilityScore,
      matchId: result.id,
    };
  }

  /** Fan out an anonymous superlike_received alert + mutual_match alerts. */
  private async fireMutualNotifications(userId: string, targetId: string): Promise<void> {
    if (!this.notify) return;
    const base = {
      type: 'mutual_match',
      title: 'It’s a match!',
      body: 'You and a member like each other. Say hello!',
      channel: NotificationChannel.InApp,
      link: '/portal/messages',
    };
    await Promise.all([
      this.notify.create({ ...base, userId: userId }),
      this.notify.create({ ...base, userId: targetId }),
    ]);
  }

  async isMutual(a: string, b: string): Promise<boolean> {
    const row = await this.repo.findActionBetween(a, b);
    return row?.status === 'mutual';
  }

  async getSuperlikesReceived(
    userId: string,
  ): Promise<{ items: SuperlikeReceived[]; count: number }> {
    const rows = await this.repo.findSuperlikesReceived(userId);
    const items: SuperlikeReceived[] = rows.map((r) => ({
      matchId: r.id,
      createdAt: r.createdAt.toISOString(),
      anonymous: true,
    }));
    return { items, count: items.length };
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
   * Strictly gated: the viewer must be vetted AND have a complete profile
   * (enforced in `runEngine`, defense-in-depth on top of the route's
   * requireVetted() middleware). Migrated onto the hybrid MatchingEngine
   * (breakdown §9 pipeline) — content + collaborative filtering, cold-start
   * fallback, popularity damping, business rules, MMR diversity, fairness
   * re-rank. Returns `RecommendCard` (a superset of `DiscoverCard`) so existing
   * web clients keep working while gaining the richer explainability fields.
   * No ML/AI involved.
   */
  async discover(userId: string, opts: DiscoverQuery & { limit?: number } = {}): Promise<RecommendCard[]> {
    const tier = await this.repo.loadUserTier(userId);
    if (!tier.isVetted) {
      // Unvetted members get a small, capped, non-personalised preview instead
      // of a 403 — they can see who is on the platform but cannot act or see a
      // personalised deck. Personalisation + action stay gated behind vetting.
      const preview = await this.getPreview(opts.limit);
      return preview as unknown as RecommendCard[];
    }
    return this.runEngine(userId, { ...opts, limit: opts.limit });
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
   * The collaborative-filtering interaction sample.
   *
   * This is a global (not per-viewer) 2000-row read that barely changes between
   * requests, so it is cached separately from the per-viewer deck. Without this
   * every cache-miss discover paid for a large ordered scan of `match_matches`
   * on top of its own queries.
   */
  private async loadInteractionSample(): Promise<
    { userId: string; itemId: string; value: number }[]
  > {
    const key = `match:cf-sample:${CF_SAMPLE_SIZE}`;
    if (process.env.NODE_ENV !== 'test') {
      const cached = await redisGetJson<{ userId: string; itemId: string; value: number }[]>(
        key,
      ).catch(() => null);
      if (cached && Array.isArray(cached)) return cached;
    }
    const sample = await this.repo.getInteractionSample(CF_SAMPLE_SIZE);
    if (process.env.NODE_ENV !== 'test') {
      await redisSetJson(key, sample, 120).catch(() => {});
    }
    return sample;
  }

  /**
   * Shared engine runner for `discover` and `recommend`. Loads the viewer, the
   * collaborative-filtering interaction sample, candidate metadata (Elo, age,
   * like-count) and the geo-filtered candidate pool, then delegates ranking to
   * the pure `MatchingEngine`. Returns `RecommendCard[]`.
   */
  private async runEngine(
    userId: string,
    opts: { limit?: number; radiusKm?: number; city?: City; ageMin?: number; ageMax?: number; interests?: string[] } = {},
  ): Promise<RecommendCard[]> {
    const viewer = await this.profileRepo.findByUserId(userId);
    if (!viewer) throw new NotFoundError('Complete your profile before discovering');
    if (viewer.isPaused) throw new ValidationError('Your profile is currently paused');
    // Strict gate: discovery is a vetted-member surface. The viewer must have a
    // complete profile (the pre-condition for vetting) — we refuse early so an
    // incomplete applicant cannot browse the pool while still drafting.
    // Prototype: relaxed because onboarding collects only the essentials.
    if (!viewer.isComplete && !config.prototypeMode) {
      throw new ValidationError('Complete your profile before discovering');
    }

    const prefs = (viewer.preferences as MatchPreferences) ?? {};
    const viewerDeal = (viewer as { dealbreakers?: string[] }).dealbreakers ?? [];
    const radiusKm = Math.min(
      MAX_MATCH_RADIUS_KM,
      Math.max(1, opts.radiusKm ?? prefs.distanceKm ?? DEFAULT_MATCH_RADIUS_KM),
    );
    const topN = Math.min(50, opts.limit ?? RECOMMEND_TOP_N);

    // The key must cover every input that changes the result. It previously
    // only had userId/topN/radius, so applying a city or age filter could hand
    // back the unfiltered deck for the whole TTL.
    const filterSig = [
      opts.city ?? '',
      opts.ageMin ?? '',
      opts.ageMax ?? '',
      (opts.interests ?? []).slice().sort().join(','),
    ].join('|');
    const cacheKey = `match:discover:${userId}:${topN}:${radiusKm}:${filterSig}`;
    if (process.env.NODE_ENV !== 'test') {
      const cached = await redisGetJson<RecommendCard[]>(cacheKey).catch(() => null);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        logger.debug({ userId, cacheKey }, 'Discover cache hit');
        return cached;
      }
    }

    const [tier, accountCreatedAt, likedItemIds, interactions] = await Promise.all([
      this.repo.loadUserTier(userId),
      this.repo.loadAccountCreatedAt(userId),
      this.repo.getViewerLikes(userId),
      this.loadInteractionSample(),
    ]);
    // Defense-in-depth vetting gate. The route mounts requireVetted(), but we
    // also enforce it here so the restriction holds even if a future caller
    // forgets the middleware. Mirrors config/middleware/vetting.ts semantics.
    if (!tier.isVetted) {
      throw new AuthorizationError(
        'Your membership is not yet verified. Complete vetting to unlock discovery.',
        { stage: 'unvetted' },
      );
    }
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

    // ── Opt-in Discover filters (narrow the candidate pool up front) ──
    if (opts.city) where.city = opts.city;
    if (opts.ageMin != null || opts.ageMax != null) {
      const now = Date.now();
      const YR = 365.25 * 24 * 3600 * 1000;
      const dob: Prisma.DateTimeFilter = {};
      // ageMin N  => born on/before (now - N years)
      if (opts.ageMin != null) dob.lte = new Date(now - opts.ageMin * YR);
      // ageMax N  => born on/after  (now - (N+1) years) so age N is included
      if (opts.ageMax != null) dob.gte = new Date(now - (opts.ageMax + 1) * YR);
      where.dateOfBirth = dob;
    }
    if (opts.interests && opts.interests.length > 0) {
      where.interests = { hasSome: opts.interests };
    }

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

    const cards = ranked.map((r) => {
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

    if (process.env.NODE_ENV !== 'test') {
      await redisSetJson(cacheKey, cards, 30).catch(() => {});
    }
    return cards;
  }

  /**
   * Unvetted members preview a small, capped sample of seeded (complete +
   * verified) members to encourage profile completion. Unlike `discover`, this
   * is NOT personalised by the viewer's preferences and is hard-capped at
   * DISCOVER_PREVIEW_LIMIT so an unverified account can never browse the full
   * discovery pool. The act of connecting remains gated by vetting elsewhere.
   */
  async getPreview(limit?: number, excludeUserId?: string): Promise<DiscoverCard[]> {
    const cap = Math.min(limit ?? DISCOVER_PREVIEW_LIMIT, DISCOVER_PREVIEW_LIMIT);

    const candidates = await this.repo.findMatchableCandidates(
      {
        isPaused: false,
        isComplete: true,
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
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
