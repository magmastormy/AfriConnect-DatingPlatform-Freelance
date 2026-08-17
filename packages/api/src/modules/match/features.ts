/**
 * features.ts — Feature engineering for Learning-to-Rank and future deep models
 * (breakdown §4, §5, §6).
 *
 * IMPORTANT: none of these functions train or invoke a model. They only
 * assemble the numeric / structural tensors a future model would consume:
 *   • extractLtrFeatures  → flat feature vector for XGBoost / LambdaMART / LR
 *   • extractContextFeatures → time-of-day / day-of-week / session-depth signals
 *   • extractSwipeSequence → ordered item ids for Transformer/GRU sequential models
 *   • buildInteractionGraph → adjacency list for Graph Neural Networks
 *   • applyExploration     → RL exploration hook (epsilon-greedy / Thompson) to
 *     fight filter bubbles — pure sampling, no policy network.
 * Building these now means the ML/RL layer slots in later without restructuring
 * the data pipeline.
 */
import { jaccardSimilarity } from './similarity';
import { InteractionRecord } from './collaborative';

export interface FeatureViewer {
  educationLevel?: string | null;
  age?: number | null;
  interests?: string[];
  relationshipGoals?: string[];
  likeRatio?: number; // historical likes / (likes + passes)
  activeHour?: number;
}

export interface FeatureCandidate {
  educationLevel?: string | null;
  age?: number | null;
  interests?: string[];
  relationshipGoals?: string[];
  likedByCount?: number;
  verified?: boolean;
}

export interface LtrContext {
  now: Date;
  sessionDepth: number; // how many cards the viewer has seen this session
}

/** Context features (breakdown §4 "Context features"). */
export function extractContextFeatures(ctx: LtrContext): Record<string, number> {
  const hour = ctx.now.getHours();
  const day = ctx.now.getDay();
  return {
    hour_of_day: hour,
    is_evening: hour >= 18 && hour <= 23 ? 1 : 0,
    day_of_week: day,
    is_weekend: day === 0 || day === 6 ? 1 : 0,
    session_depth: ctx.sessionDepth,
  };
}

/** Flat, model-ready feature vector (breakdown §4 key features). */
export function extractLtrFeatures(
  viewer: FeatureViewer,
  candidate: FeatureCandidate,
  ctx: LtrContext,
): number[] {
  const ctxF = extractContextFeatures(ctx);
  const interestOverlap = jaccardSimilarity(viewer.interests ?? [], candidate.interests ?? []);
  const goalOverlap = jaccardSimilarity(
    viewer.relationshipGoals ?? [],
    candidate.relationshipGoals ?? [],
  );
  return [
    viewer.age ?? -1,
    candidate.age ?? -1,
    viewer.likeRatio ?? 0,
    interestOverlap,
    goalOverlap,
    candidate.likedByCount ?? 0,
    candidate.verified ? 1 : 0,
    ctxF.is_evening,
    ctxF.is_weekend,
    ctxF.session_depth,
  ];
}

/** Ordered swipe sequence for sequential / Transformer models (breakdown §5b). */
export function extractSwipeSequence(interactions: InteractionRecord[]): string[] {
  return interactions.map((r) => r.itemId); // callers pass records chronologically
}

/** Undirected interaction graph for GNNs (breakdown §5d). */
export function buildInteractionGraph(records: InteractionRecord[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const ensure = (id: string) => {
    let s = graph.get(id);
    if (!s) {
      s = new Set();
      graph.set(id, s);
    }
    return s;
  };
  for (const r of records) {
    ensure(r.userId).add(r.itemId);
    ensure(r.itemId).add(r.userId);
  }
  return graph;
}

/**
 * RL exploration hook (breakdown §6). With probability `epsilon`, promote a
 * low-relevance candidate into the result to inject serendipity and break
 * filter bubbles. `rng` is injectable for deterministic tests; pass Math.random
 * in production. This is sampling-only — no learned policy.
 */
export function applyExploration<T extends { score: number }>(
  ranked: T[],
  pool: T[],
  epsilon: number,
  rng: () => number = Math.random,
  idOf: (item: T) => string | undefined = (item) => (item as unknown as { userId?: string }).userId,
): T[] {
  if (ranked.length === 0 || pool.length === 0 || rng() > epsilon) return ranked;
  const inRanked = new Set(ranked.map(idOf));
  const candidates = pool.filter((p) => {
    const id = idOf(p);
    return id === undefined || !inRanked.has(id);
  });
  if (candidates.length === 0) return ranked;
  const pick = candidates[Math.floor(rng() * candidates.length)];
  return [pick, ...ranked];
}
