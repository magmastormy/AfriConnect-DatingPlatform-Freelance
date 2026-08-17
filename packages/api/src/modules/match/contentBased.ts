/**
 * contentBased.ts — Content-Based Filtering (breakdown §3).
 *
 * Matches candidates on explicit profile attributes using classical similarity
 * metrics (cosine on a joint feature vector, Jaccard on interest overlap). This
 * is the smooth, personalised layer that sits alongside the rules-based
 * `scoreCompatibility` (see scoring.ts). No embeddings or NLP are used — only
 * structured, first-party profile fields.
 */
import { City, EducationLevel, Gender, RelationshipGoal } from '@africonnect/shared';
import { cosineSimilarity, jaccardSimilarity, multiHot, oneHot } from './similarity';

const CITY_VOCAB = Object.values(City);
const GENDER_VOCAB = Object.values(Gender);
const GOAL_VOCAB = Object.values(RelationshipGoal);

const EDU_RANK: Record<EducationLevel, number> = {
  diploma: 1,
  bachelors: 2,
  honours: 3,
  professional: 3,
  masters: 4,
  phd: 5,
};

export interface ContentProfile {
  city?: City;
  educationLevel?: EducationLevel | null;
  gender?: Gender;
  interests?: string[];
  industries?: string[];
  relationshipGoals?: RelationshipGoal | RelationshipGoal[];
}

/** Jaccard overlap of two interest lists (0 = disjoint, 1 = identical). */
export function interestsJaccard(a?: string[], b?: string[]): number {
  return jaccardSimilarity(a ?? [], b ?? []);
}

/**
 * Joint feature vector for cosine similarity. Vocabularies for the free-text
 * interest/industry fields are passed in (typically the union of the viewer's
 * and candidate's values) so both vectors share the same dimensions.
 */
export function contentFeatureVector(
  p: ContentProfile,
  interestVocab: readonly string[],
  industryVocab: readonly string[],
): number[] {
  const edu = p.educationLevel ? EDU_RANK[p.educationLevel] : 0;
  const city = oneHot(p.city ?? '', CITY_VOCAB);
  const gender = oneHot(p.gender ?? '', GENDER_VOCAB);
  const goals = multiHot(
    Array.isArray(p.relationshipGoals)
      ? p.relationshipGoals
      : p.relationshipGoals
        ? [p.relationshipGoals]
        : [],
    GOAL_VOCAB,
  );
  const interests = multiHot(p.interests ?? [], interestVocab);
  const industries = multiHot(p.industries ?? [], industryVocab);
  return [edu, ...city, ...gender, ...goals, ...interests, ...industries];
}

/** Cosine similarity of two profiles over their joint content feature vector. */
export function contentCosineSimilarity(viewer: ContentProfile, candidate: ContentProfile): number {
  const interestVocab = Array.from(
    new Set([...(viewer.interests ?? []), ...(candidate.interests ?? [])]),
  );
  const industryVocab = Array.from(
    new Set([...(viewer.industries ?? []), ...(candidate.industries ?? [])]),
  );
  const a = contentFeatureVector(viewer, interestVocab, industryVocab);
  const b = contentFeatureVector(candidate, interestVocab, industryVocab);
  return cosineSimilarity(a, b);
}

/** Smooth content boost (0..maxBoost) derived from cosine similarity. */
export function contentBoost(
  viewer: ContentProfile,
  candidate: ContentProfile,
  maxBoost = 10,
): number {
  return Math.round(contentCosineSimilarity(viewer, candidate) * maxBoost);
}
