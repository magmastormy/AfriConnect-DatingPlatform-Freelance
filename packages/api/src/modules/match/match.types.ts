import {
  MatchAction,
  EducationLevel,
  Gender,
  City,
  RelationshipGoal,
  MatchStatus,
} from '@africonnect/shared';

/** Normalised candidate shape consumed by the scoring engine. */
export interface MatchCandidate {
  userId: string;
  gender: Gender;
  city: City;
  educationLevel: EducationLevel;
  dateOfBirth: Date | null;
  relationshipGoals?: RelationshipGoal;
  interests?: string[];
  profession?: string;
  dealbreakers?: string[];
  verified?: boolean;
}

/**
 * Viewer preference object. Stored on Profile.preferences (JSON) and used by
 * the rules-based scorer (see scoring.ts).
 */
export interface MatchPreferences {
  genderPreference?: Gender;
  educationMin?: EducationLevel;
  professions?: string[];
  ageMin?: number;
  ageMax?: number;
  city?: City;
  /** Optional discovery radius (km); the MatchingEngine falls back to a default. */
  distanceKm?: number;
  relationshipGoals?: RelationshipGoal[];
  interests?: string[];
}

/** A candidate that survived scoring, with its compatibility score attached. */
export interface ScoredCandidate {
  candidate: MatchCandidate;
  score: number;
}

/** A single entry persisted in the daily queue. */
export interface DailyMatchEntry {
  userId: string;
  score: number;
  displayName: string | null;
  city: City;
  educationLevel: EducationLevel | null;
  profession: string | null;
  photo: string | null;
  distanceKm: number | null;
}

/** A swipe card surfaced by GET /matches/discover. */
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

export interface ExpressInterestInput {
  targetId: string;
  action: MatchAction;
}

/** A pending superlike the caller received. Sender stays anonymous (POPIA). */
export interface SuperlikeReceived {
  matchId: string; // Match row id (for future view/undo)
  createdAt: string; // ISO 8601
  anonymous: true; // never carries sender identity until mutual
}

/** A recommendation card returned by GET /matches/recommend (full algorithm pipeline). */
export interface RecommendCard extends DiscoverCard {
  distanceKm: number | null;
  contentScore: number;
  cfScore: number;
  coldStart: boolean;
  /** Per-candidate score breakdown for explainability/debugging. */
  breakdown: {
    base: number;
    popularityAdjustment: number;
    premiumBoost: number;
    newUserBoost: number;
    diversityApplied: boolean;
    fairnessAdjusted: boolean;
  };
}

/** Persisted record returned by the repository's action upsert. */
export interface MatchActionRecord {
  id: string;
  userId: string;
  matchedUserId: string;
  status: MatchStatus;
  score?: number | null;
}
