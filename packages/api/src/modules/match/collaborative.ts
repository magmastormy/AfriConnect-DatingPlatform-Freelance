/**
 * collaborative.ts — Collaborative Filtering (breakdown §2).
 *
 * Classic, model-free CF over an explicit user–item interaction matrix built
 * from like / superlike / pass events (no ML, no training):
 *   • item-based CF  — recommend profiles similar to ones the viewer liked
 *     (cosine over the user-vectors that interacted with each item).
 *   • user-based CF  — find viewers with similar taste and borrow their ratings
 *     of the candidate (weighted by cosine user-similarity).
 *
 * The matrix is assembled by `buildInteractionMatrix` from raw interaction
 * records. A future SVD / ALS / neural-CF layer can replace `cfAffinity` without
 * touching callers — the InteractionMatrix contract is the seam.
 */
import { cosineSimilarity } from './similarity';

export interface InteractionRecord {
  userId: string;
  itemId: string;
  /** +1 like, +2 superlike, -1 pass; 0 = no interaction. */
  value: number;
}

export interface InteractionMatrix {
  userIds: string[];
  userIndex: Map<string, number>;
  itemIds: string[];
  itemIndex: Map<string, number>;
  /** values[userIdx][itemIdx] = interaction value (0 if none). */
  values: number[][];
}

export function buildInteractionMatrix(records: InteractionRecord[]): InteractionMatrix {
  const userIds: string[] = [];
  const userIndex = new Map<string, number>();
  const itemIds: string[] = [];
  const itemIndex = new Map<string, number>();

  for (const r of records) {
    if (!userIndex.has(r.userId)) {
      userIndex.set(r.userId, userIds.length);
      userIds.push(r.userId);
    }
    if (!itemIndex.has(r.itemId)) {
      itemIndex.set(r.itemId, itemIds.length);
      itemIds.push(r.itemId);
    }
  }

  const values = userIds.map(() => new Array(itemIds.length).fill(0));
  for (const r of records) {
    values[userIndex.get(r.userId)!][itemIndex.get(r.itemId)!] = r.value;
  }
  return { userIds, userIndex, itemIds, itemIndex, values };
}

function itemVector(m: InteractionMatrix, itemIdx: number): number[] {
  return m.values.map((row) => row[itemIdx]);
}

function userVector(m: InteractionMatrix, userIdx: number): number[] {
  return m.values[userIdx];
}

/**
 * Item-based affinity: mean cosine similarity between the candidate item and
 * each item the viewer liked. Returns 0..1; 0 when no signal.
 */
export function itemBasedAffinity(
  viewerLikedItemIds: readonly string[],
  itemId: string,
  m: InteractionMatrix,
): number {
  if (!m.itemIndex.has(itemId)) return 0;
  const target = itemVector(m, m.itemIndex.get(itemId)!);
  let sum = 0;
  let den = 0;
  for (const liked of viewerLikedItemIds) {
    if (liked === itemId || !m.itemIndex.has(liked)) continue;
    sum += cosineSimilarity(target, itemVector(m, m.itemIndex.get(liked)!));
    den++;
  }
  return den === 0 ? 0 : sum / den;
}

/**
 * User-based affinity: predict the viewer's rating of `itemId` as the
 * similarity-weighted average of other users' ratings of that item. Raw
 * ratings in [-1,2] are mapped to 0..1. Returns 0 when no signal.
 */
export function userBasedAffinity(viewerId: string, itemId: string, m: InteractionMatrix): number {
  if (!m.userIndex.has(viewerId) || !m.itemIndex.has(itemId)) return 0;
  const viewerIdx = m.userIndex.get(viewerId)!;
  const itemIdx = m.itemIndex.get(itemId)!;
  const viewerVec = userVector(m, viewerIdx);

  let num = 0;
  let den = 0;
  for (let u = 0; u < m.userIds.length; u++) {
    if (u === viewerIdx) continue;
    const sim = cosineSimilarity(viewerVec, userVector(m, u));
    if (sim <= 0) continue;
    const rating = m.values[u][itemIdx];
    if (rating === 0) continue;
    num += sim * rating;
    den += Math.abs(sim);
  }
  if (den === 0) return 0;
  const pred = num / den; // in [-1, 2]
  return Math.min(1, Math.max(0, (pred + 1) / 3));
}

/** Blended CF affinity (0..1). Returns 0 when the matrix carries no signal. */
export function cfAffinity(
  viewerId: string,
  viewerLikedItemIds: readonly string[],
  itemId: string,
  m: InteractionMatrix,
): number {
  const ib = itemBasedAffinity(viewerLikedItemIds, itemId, m);
  const ub = userBasedAffinity(viewerId, itemId, m);
  if (ib === 0 && ub === 0) return 0;
  return (ib + ub) / 2;
}
