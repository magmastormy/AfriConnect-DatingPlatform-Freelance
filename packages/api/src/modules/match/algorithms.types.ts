/**
 * algorithms.types.ts — shared shapes for the MatchingEngine (breakdown §9
 * "Simplified Starter Architecture").
 */
import { Gender, City, EducationLevel, RelationshipGoal } from '@africonnect/shared';
import { MatchPreferences } from './match.types';
import { InteractionMatrix } from './collaborative';

export interface EngineViewer {
  userId: string;
  preferences: MatchPreferences;
  dealbreakers?: string[];
  latitude?: number | null;
  longitude?: number | null;
  city?: City;
  isPremium: boolean;
  accountAgeDays: number;
  elo: number;
  /** Profiles the viewer has liked / superliked (drives item-based CF). */
  likedItemIds: string[];
}

export interface EngineCandidate {
  userId: string;
  gender: Gender;
  city: City;
  educationLevel: EducationLevel;
  dateOfBirth: Date | null;
  latitude?: number | null;
  longitude?: number | null;
  relationshipGoals?: RelationshipGoal;
  interests?: string[];
  industries?: string[];
  profession?: string;
  dealbreakers?: string[];
  verified?: boolean;
  isPremium: boolean;
  accountAgeDays: number;
  elo: number;
  /** How many distinct viewers have liked this candidate (popularity signal). */
  likedByCount: number;
}

export interface EngineConfig {
  radiusKm: number;
  contentWeight: number;
  cfWeight: number;
  mmrLambda: number;
  premiumBoost: number;
  newUserBoost: number;
  newUserWindowDays: number;
  coldStartLikes: number;
  popularityAdjustMax: number;
  fairnessMinGroupRatio: number;
  topN: number;
  /** Minimum score a candidate must reach before diversity/fairness re-ranking. */
  minScore: number;
  enableDiversity: boolean;
  enableFairness: boolean;
  enableBusinessRules: boolean;
  /** RL exploration rate for serendipity (0 disables). */
  explorationEpsilon: number;
}

export interface RankedCandidate {
  candidate: EngineCandidate;
  score: number;
  contentScore: number;
  cfScore: number;
  distanceKm: number | null;
  breakdown: {
    base: number;
    coldStartFallback: boolean;
    popularityAdjustment: number;
    premiumBoost: number;
    newUserBoost: number;
    diversityApplied: boolean;
    fairnessAdjusted: boolean;
  };
}

export type { InteractionMatrix };
