/**
 * fairness.ts — Fairness-aware exposure re-ranking (breakdown §8 anti-discrimination).
 *
 * After scoring, this guarantees every protected group (e.g. gender) a minimum
 * share of the returned set, promoting the highest-scoring member of any
 * under-represented group. It preserves overall score ordering while preventing
 * algorithmic amplification of imbalance. No protected attribute is weighted
 * inside the scoring itself — fairness is applied only as an exposure
 * constraint, keeping the scorer attribute-blind.
 */
export interface FairnessItem<T> {
  payload: T;
  score: number;
  group: string;
}

/**
 * Re-rank `items` (already sorted by score desc) so each group holds at least
 * `minRatio` of `topN` slots. Quotas are group minimums only; once satisfied the
 * remaining slots go to the highest-scoring candidates regardless of group.
 */
export function fairnessRerank<T>(
  items: FairnessItem<T>[],
  topN: number,
  minRatio: number,
): FairnessItem<T>[] {
  if (items.length <= 1) return items;

  const groups = Array.from(new Set(items.map((i) => i.group)));
  if (groups.length <= 1) return items.slice(0, topN);

  const quota = new Map<string, number>();
  for (const g of groups) quota.set(g, Math.max(1, Math.floor(topN * minRatio)));

  const filled = new Map<string, number>();
  for (const g of groups) filled.set(g, 0);

  const result: FairnessItem<T>[] = [];
  const rest = [...items];

  while (result.length < topN && rest.length > 0) {
    let pickIdx = -1;
    for (let i = 0; i < rest.length; i++) {
      const g = rest[i].group;
      if (filled.get(g)! < quota.get(g)!) {
        pickIdx = i;
        break;
      }
    }
    if (pickIdx === -1) pickIdx = 0; // all quotas met — take next best by score
    const picked = rest.splice(pickIdx, 1)[0];
    result.push(picked);
    filled.set(picked.group, filled.get(picked.group)! + 1);
  }
  return result;
}
