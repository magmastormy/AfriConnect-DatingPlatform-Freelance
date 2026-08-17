/**
 * diversity.ts — Maximal Marginal Relevance re-ranking (breakdown §8 filter
 * bubbles / §9 step 5).
 *
 * MMR trades a little relevance for diversity: each pick maximizes
 *   λ·relevance − (1−λ)·maxSimilarityToAlreadySelected.
 * This is the standard anti-homogeneity / serendipity step and runs purely on
 * cosine similarity between candidate feature vectors — no ML.
 */
import { cosineSimilarity } from './similarity';

export interface MmrItem<T> {
  id: string;
  /** Relevance in [0,1]. */
  relevance: number;
  /** Feature vector used for pairwise diversity distance. */
  vector: number[];
  payload: T;
}

/**
 * Re-rank `items` by MMR and return at most `topN`. `relevance` MUST be in
 * [0,1]; `lambda` in [0,1] (higher = more relevance, less diversity).
 */
export function mmrRerank<T>(items: MmrItem<T>[], lambda: number, topN: number): MmrItem<T>[] {
  const pool = [...items];
  const selected: MmrItem<T>[] = [];

  while (selected.length < topN && pool.length > 0) {
    let bestIdx = 0;
    let bestVal = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const maxSim = selected.length
        ? Math.max(...selected.map((s) => cosineSimilarity(s.vector, pool[i].vector)))
        : 0;
      const val = lambda * pool[i].relevance - (1 - lambda) * maxSim;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }
    selected.push(pool.splice(bestIdx, 1)[0]);
  }
  return selected;
}
