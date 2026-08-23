import {
  MATCH_SCORE_EDUCATION,
  MATCH_SCORE_PROFESSION,
  MATCH_SCORE_AGE,
  MATCH_SCORE_CITY,
  MATCH_SCORE_GOALS,
  MATCH_SCORE_INTERESTS,
  MATCH_PENALTY_PASSED,
  MATCH_PENALTY_BLOCKED,
  MATCH_PENALTY_DEALBREAKER,
  MATCH_BONUS_VERIFIED,
  MIN_COMPATIBILITY_THRESHOLD,
} from '@africonnect/shared';
import { MatchCandidate, MatchPreferences, ScoredCandidate } from './match.types';
import { EducationLevel } from '@africonnect/shared';

const EDUCATION_RANK: Record<EducationLevel, number> = {
  diploma: 1,
  bachelors: 2,
  honours: 3,
  professional: 3,
  masters: 4,
  phd: 5,
};

function ageFromDob(dob: Date, now = new Date()): number {
  const diff = now.getTime() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

/**
 * Enhanced rules-based compatibility score (Technical Stack §3 Module 4).
 * Combines the original weighted signals with dealbreaker penalties and a
 * verified-identity bonus. Pure function — unit-tested. Returns 0..100.
 */
export function scoreCompatibility(
  viewer: { preferences: MatchPreferences; dealbreakers?: string[]; verified?: boolean },
  candidate: MatchCandidate,
): number {
  let score = 0;

  if (viewer.preferences.educationMin) {
    const minRank = EDUCATION_RANK[viewer.preferences.educationMin];
    if (EDUCATION_RANK[candidate.educationLevel] >= minRank) score += MATCH_SCORE_EDUCATION;
  } else {
    score += MATCH_SCORE_EDUCATION; // no preference — neutral credit
  }

  if (
    viewer.preferences.professions?.length &&
    candidate.profession &&
    viewer.preferences.professions.includes(candidate.profession)
  ) {
    score += MATCH_SCORE_PROFESSION;
  }

  if (viewer.preferences.ageMin && viewer.preferences.ageMax && candidate.dateOfBirth) {
    const age = ageFromDob(candidate.dateOfBirth);
    if (age >= viewer.preferences.ageMin && age <= viewer.preferences.ageMax) {
      score += MATCH_SCORE_AGE;
    }
  }

  if (viewer.preferences.city && candidate.city === viewer.preferences.city) {
    score += MATCH_SCORE_CITY;
  }

  if (
    viewer.preferences.relationshipGoals?.length &&
    candidate.relationshipGoals &&
    viewer.preferences.relationshipGoals.includes(candidate.relationshipGoals)
  ) {
    score += MATCH_SCORE_GOALS;
  }

  const viewerInterests = (viewer.preferences as { interests?: string[] }).interests ?? [];
  const shared = candidate.interests?.filter((i) => viewerInterests.includes(i)) ?? [];
  if (shared.length >= 3) score += MATCH_SCORE_INTERESTS;
  else if (shared.length === 2) score += Math.round(MATCH_SCORE_INTERESTS * 0.6);
  else if (shared.length === 1) score += Math.round(MATCH_SCORE_INTERESTS * 0.3);

  // Dealbreakers (e.g., smoking, distance, religion) invert the match.
  const deal = viewer.dealbreakers ?? [];
  if (deal.length && candidate.dealbreakers?.some((d) => deal.includes(d))) {
    score -= MATCH_PENALTY_DEALBREAKER;
  }

  // Verified candidates (ID + degree) are more trustworthy matches.
  if (candidate.verified) score += MATCH_BONUS_VERIFIED;

  return Math.min(100, Math.max(0, score));
}

export function applyPenalties(
  score: number,
  flags: { passed?: boolean; blocked?: boolean },
): number {
  let s = score;
  if (flags.passed) s -= MATCH_PENALTY_PASSED;
  if (flags.blocked) s -= MATCH_PENALTY_BLOCKED;
  return Math.min(100, Math.max(0, s));
}

export function passesThreshold(
  score: number,
  threshold: number = MIN_COMPATIBILITY_THRESHOLD,
): boolean {
  return score >= threshold;
}

export function rankCandidates(
  viewer: { preferences: MatchPreferences },
  candidates: MatchCandidate[],
  flags: Record<string, { passed?: boolean; blocked?: boolean }> = {},
): ScoredCandidate[] {
  return candidates
    .map((candidate) => {
      const base = scoreCompatibility({ preferences: viewer.preferences }, candidate);
      const final = applyPenalties(base, flags[candidate.userId] ?? {});
      return { candidate, score: final };
    })
    .filter((s) => passesThreshold(s.score))
    .sort((a, b) => b.score - a.score);
}

export { ageFromDob };
