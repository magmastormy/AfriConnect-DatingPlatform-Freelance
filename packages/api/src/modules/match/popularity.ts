/**
 * popularity.ts — Elo popularity normalization (breakdown §7 Tinder-style + §8
 * popularity-bias mitigation).
 *
 * Every profile carries an Elo score that rises when it is liked and falls when
 * it is passed. We don't use it to *promote* popular profiles (that amplifies
 * popularity bias); instead `popularityAdjustment` damps over-popular profiles
 * and gently lifts under-exposed ones — calibrated exposure without ML.
 */
import { ELO_INITIAL, POPULARITY_ADJUST_MAX, POPULARITY_ELO_K } from '@africonnect/shared';

/** Expected win probability of A over B under the logistic Elo curve. */
export function eloExpected(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** Returns the new [winner, loser] Elo after a single comparison. */
export function updateElo(
  winner: number,
  loser: number,
  k: number = POPULARITY_ELO_K,
): [number, number] {
  const eW = eloExpected(winner, loser);
  const eL = eloExpected(loser, winner);
  return [winner + k * (1 - eW), loser + k * (0 - eL)];
}

/** Maps an Elo score to 0..1 centred on the initial value (0.5 == average). */
export function normalizeElo(elo: number, initial: number = ELO_INITIAL): number {
  return 1 / (1 + Math.pow(10, (initial - elo) / 400));
}

/**
 * Popularity-bias adjustment in points, clamped to ±POPULARITY_ADJUST_MAX.
 * Under-exposed profiles (low Elo) receive a positive boost; over-popular
 * profiles (high Elo) receive a penalty — mitigating the rich-get-richer
 * dynamic described in §8.
 */
export function popularityAdjustment(
  elo: number,
  initial: number = ELO_INITIAL,
  max: number = POPULARITY_ADJUST_MAX,
): number {
  const adj = -(normalizeElo(elo, initial) - 0.5) * 2 * max;
  return Math.round(adj);
}
