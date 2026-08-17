/**
 * engine.ts — MatchingEngine: the hybrid recommender (breakdown §9 "Simplified
 * Starter Architecture" + §1–§8 mitigations).
 *
 * Pure pipeline (no I/O), so it is fully unit-testable:
 *   1. Hard constraints   — orientation, age range, distance radius, dealbreakers
 *   2. Score              — content-based (rules + cosine) blended with CF
 *   3. Cold start         — fall back to content + popularity when no CF signal
 *   4. Popularity damping — Elo-based calibrated exposure (bias mitigation)
 *   5. Business rules      — Premium boost, new-user boost
 *   6. Diversity (MMR)     — fight filter bubbles / homogeneity
 *   7. Fairness re-rank    — minimum exposure per protected group
 *   8. RL exploration      — serendipity injection (epsilon-greedy)
 *   9. Return top-N
 *
 * No ML, embeddings, or trained models are used anywhere in this file.
 */
import {
  CONTENT_WEIGHT,
  CF_WEIGHT,
  MMR_LAMBDA,
  PREMIUM_BOOST,
  NEW_USER_BOOST,
  NEW_USER_WINDOW_DAYS,
  COLD_START_LIKES,
  POPULARITY_ADJUST_MAX,
  FAIRNESS_MIN_GROUP_RATIO,
  RECOMMEND_TOP_N,
  MIN_COMPATIBILITY_THRESHOLD,
  DEFAULT_MATCH_RADIUS_KM,
  MAX_MATCH_RADIUS_KM,
} from '@africonnect/shared';
import { scoreCompatibility, passesThreshold, ageFromDob } from './scoring';
import { withinRadius, haversineKm } from './geo';
import { contentFeatureVector } from './contentBased';
import { cfAffinity, InteractionMatrix } from './collaborative';
import { popularityAdjustment } from './popularity';
import { mmrRerank, MmrItem } from './diversity';
import { isColdStart, coldStartBlend } from './coldStart';
import { fairnessRerank } from './fairness';
import { applyExploration } from './features';
import { EngineCandidate, EngineConfig, EngineViewer, RankedCandidate } from './algorithms.types';

export function buildDefaultConfig(partial: Partial<EngineConfig> = {}): EngineConfig {
  return {
    radiusKm: DEFAULT_MATCH_RADIUS_KM,
    contentWeight: CONTENT_WEIGHT,
    cfWeight: CF_WEIGHT,
    mmrLambda: MMR_LAMBDA,
    premiumBoost: PREMIUM_BOOST,
    newUserBoost: NEW_USER_BOOST,
    newUserWindowDays: NEW_USER_WINDOW_DAYS,
    coldStartLikes: COLD_START_LIKES,
    popularityAdjustMax: POPULARITY_ADJUST_MAX,
    fairnessMinGroupRatio: FAIRNESS_MIN_GROUP_RATIO,
    topN: RECOMMEND_TOP_N,
    minScore: MIN_COMPATIBILITY_THRESHOLD,
    enableDiversity: true,
    enableFairness: true,
    enableBusinessRules: true,
    explorationEpsilon: 0,
    ...partial,
  };
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export class MatchingEngine {
  constructor(private readonly config: EngineConfig = buildDefaultConfig()) {}

  recommend(
    viewer: EngineViewer,
    candidates: EngineCandidate[],
    matrix: InteractionMatrix | null,
  ): RankedCandidate[] {
    const radiusKm = Math.min(MAX_MATCH_RADIUS_KM, Math.max(1, this.config.radiusKm));
    const prefs = viewer.preferences;

    // Shared vocabularies so every candidate's diversity vector is comparable.
    const interestVocab = Array.from(
      new Set(candidates.flatMap((c) => c.interests ?? [])),
    );
    const industryVocab = Array.from(
      new Set(candidates.flatMap((c) => c.industries ?? [])),
    );

    // ── 1. Hard constraints ──────────────────────────────────────────────────
    const filtered = candidates.filter((c) => {
      if (prefs.genderPreference && c.gender !== prefs.genderPreference) return false;
      if (prefs.ageMin && prefs.ageMax && c.dateOfBirth) {
        const age = ageFromDob(c.dateOfBirth);
        if (age < prefs.ageMin || age > prefs.ageMax) return false;
      }
      if (!withinRadius(viewer, c, radiusKm)) return false;
      const deal = viewer.dealbreakers ?? [];
      if (deal.length && (c.dealbreakers ?? []).some((d) => deal.includes(d))) return false;
      return true;
    });

    // ── 2–5. Score each survivor ─────────────────────────────────────────────
    const scored: { rc: RankedCandidate; vector: number[] }[] = filtered.map((c) => {
      const contentScore = scoreCompatibility(
        { preferences: prefs, dealbreakers: viewer.dealbreakers },
        c,
      );
      const cfRaw = matrix ? cfAffinity(viewer.userId, viewer.likedItemIds, c.userId, matrix) : 0;
      const cfScore = Math.round(cfRaw * 100);

      const cold = isColdStart(viewer.likedItemIds.length, this.config.coldStartLikes);
      let base: number;
      let coldStartFallback = false;
      if (cold || cfScore === 0) {
        base = coldStartBlend(contentScore, c.likedByCount);
        coldStartFallback = true;
      } else {
        base = contentScore * this.config.contentWeight + cfScore * this.config.cfWeight;
      }

      const popAdj = popularityAdjustment(c.elo);
      base += popAdj;

      let premiumBoost = 0;
      let newUserBoost = 0;
      if (this.config.enableBusinessRules) {
        if (c.isPremium) premiumBoost = this.config.premiumBoost;
        if (c.accountAgeDays < this.config.newUserWindowDays) newUserBoost = this.config.newUserBoost;
        base += premiumBoost + newUserBoost;
      }

      const distanceKm = haversineKm(viewer, c);
      const vector = contentFeatureVector(c, interestVocab, industryVocab);

      const rc: RankedCandidate = {
        candidate: c,
        score: clamp(base),
        contentScore,
        cfScore,
        distanceKm,
        breakdown: {
          base: clamp(base - premiumBoost - newUserBoost - popAdj),
          coldStartFallback,
          popularityAdjustment: popAdj,
          premiumBoost,
          newUserBoost,
          diversityApplied: false,
          fairnessAdjusted: false,
        },
      };
      return { rc, vector };
    });

    // Threshold then keep a pool large enough for meaningful diversity re-ranking.
    const rcs = scored.map((s) => s.rc);
    const vectorOf = new Map(scored.map((s) => [s.rc.candidate.userId, s.vector]));
    const aboveThreshold = rcs.filter((s) => passesThreshold(s.score, this.config.minScore));
    const pool =
      aboveThreshold.length >= this.config.topN
        ? aboveThreshold
        : [...rcs].sort((a, b) => b.score - a.score).slice(0, this.config.topN);

    if (pool.length === 0) return [];

    const toMmr = (items: RankedCandidate[]): MmrItem<RankedCandidate>[] =>
      items.map((s) => ({
        id: s.candidate.userId,
        relevance: s.score / 100,
        vector: vectorOf.get(s.candidate.userId) ?? [],
        payload: s,
      }));

    // ── 6. Diversity (MMR) ───────────────────────────────────────────────────
    let ordered = pool;
    if (this.config.enableDiversity) {
      const poolSize = Math.min(pool.length, this.config.topN * 3);
      const mmr = mmrRerank(
        toMmr(pool.slice(0, poolSize).sort((a, b) => b.score - a.score)),
        this.config.mmrLambda,
        this.config.topN,
      );
      ordered = mmr.map((m) => {
        m.payload.breakdown.diversityApplied = true;
        return m.payload;
      });
    } else {
      ordered = [...pool].sort((a, b) => b.score - a.score);
    }

    // ── 7. Fairness re-rank (exposure constraint per gender group) ───────────
    let finalists = ordered;
    if (this.config.enableFairness) {
      const fair = fairnessRerank(
        ordered.map((s) => ({
          payload: s,
          score: s.score,
          group: s.candidate.gender,
        })),
        this.config.topN,
        this.config.fairnessMinGroupRatio,
      );
      finalists = fair.map((f) => {
        f.payload.breakdown.fairnessAdjusted = true;
        return f.payload;
      });
    }

    // ── 8. RL exploration (serendipity) ──────────────────────────────────────
    if (this.config.explorationEpsilon > 0) {
      finalists = applyExploration(
        finalists,
        rcs,
        this.config.explorationEpsilon,
        Math.random,
        (r) => r.candidate.userId,
      );
    }

    // ── 9. top-N ──────────────────────────────────────────────────────────────
    return finalists.slice(0, this.config.topN);
  }
}
