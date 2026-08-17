/**
 * coldStart.ts — Cold-start handling (breakdown §8).
 *
 * New viewers have no interaction history, so collaborative filtering has no
 * signal. We detect the cold-start state and fall back to a content-based +
 * popularity blend (the documented mitigation for new users / new profiles).
 */
import { COLD_START_LIKES } from '@africonnect/shared';

/** A viewer is "cold" until they have recorded at least `minLikes` likes. */
export function isColdStart(likeCount: number, minLikes: number = COLD_START_LIKES): boolean {
  return likeCount < minLikes;
}

/**
 * Cold-start blend: ignore collaborative filtering (no signal) and lean on the
 * content score plus a small popularity bump derived from how often the
 * candidate has been liked. Returns 0..100.
 */
export function coldStartBlend(contentScore: number, likedByCount: number, maxBump = 8): number {
  const popularityBump = Math.min(maxBump, likedByCount); // more liked => slightly higher
  return Math.min(100, Math.max(0, contentScore + popularityBump));
}
