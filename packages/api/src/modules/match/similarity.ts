/**
 * similarity.ts — vector math primitives for matching algorithms.
 *
 * These are pure, dependency-free functions. They power Content-Based Filtering
 * (cosine / Jaccard / Euclidean on structured profile features) and
 * Collaborative Filtering (cosine over user/item interaction vectors). No
 * embeddings, models, or ML are involved — only classical linear algebra.
 */

/** Cosine similarity of two equal-length vectors. Returns 0 when either is zero. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new RangeError('cosineSimilarity: vectors must have equal length');
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Jaccard similarity of two sets: |A ∩ B| / |A ∪ B|. Returns 0 for disjoint. */
export function jaccardSimilarity<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Euclidean distance between two equal-length vectors. */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new RangeError('euclideanDistance: vectors must have equal length');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Min–max normalize a value into [0,1] given a known range. */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Weighted sum of signed contributions, clamped to [0,100]. */
export function weightedScore(contributions: number[]): number {
  const total = contributions.reduce((acc, v) => acc + v, 0);
  return Math.min(100, Math.max(0, total));
}

/** Build a one-hot (binary) vector for `value` against a fixed vocabulary. */
export function oneHot(value: string, vocabulary: readonly string[]): number[] {
  const idx = vocabulary.indexOf(value);
  return vocabulary.map((_, i) => (i === idx ? 1 : 0));
}

/** Build a multi-hot (binary) vector for the members of `values` over a vocabulary. */
export function multiHot(values: readonly string[], vocabulary: readonly string[]): number[] {
  const set = new Set(values);
  return vocabulary.map((v) => (set.has(v) ? 1 : 0));
}
