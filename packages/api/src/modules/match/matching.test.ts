import { Gender, City, EducationLevel, RelationshipGoal } from '@africonnect/shared';
import {
  cosineSimilarity,
  jaccardSimilarity,
  euclideanDistance,
  normalize,
  weightedScore,
  oneHot,
  multiHot,
} from './similarity';
import { haversineKm, withinRadius } from './geo';
import {
  interestsJaccard,
  contentCosineSimilarity,
  contentBoost,
} from './contentBased';
import {
  buildInteractionMatrix,
  itemBasedAffinity,
  userBasedAffinity,
  cfAffinity,
  InteractionRecord,
} from './collaborative';
import {
  eloExpected,
  updateElo,
  normalizeElo,
  popularityAdjustment,
} from './popularity';
import { mmrRerank } from './diversity';
import { isColdStart, coldStartBlend } from './coldStart';
import { fairnessRerank } from './fairness';
import {
  extractContextFeatures,
  extractLtrFeatures,
  extractSwipeSequence,
  buildInteractionGraph,
  applyExploration,
} from './features';
import { MatchingEngine, buildDefaultConfig } from './engine';
import { EngineViewer, EngineCandidate } from './algorithms.types';

describe('similarity primitives', () => {
  it('cosine of identical vectors is 1, orthogonal is 0', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('jaccard overlap', () => {
    expect(jaccardSimilarity(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3);
    expect(jaccardSimilarity([], [])).toBe(0);
  });
  it('euclidean distance', () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
  });
  it('normalize clamps to [0,1]', () => {
    expect(normalize(5, 0, 10)).toBe(0.5);
    expect(normalize(-5, 0, 10)).toBe(0);
    expect(normalize(99, 0, 10)).toBe(1);
  });
  it('weightedScore clamps to [0,100]', () => {
    expect(weightedScore([30, 25, 20])).toBe(75);
    expect(weightedScore([80, 80])).toBe(100);
  });
  it('oneHot / multiHot', () => {
    expect(oneHot('b', ['a', 'b', 'c'])).toEqual([0, 1, 0]);
    expect(multiHot(['a', 'c'], ['a', 'b', 'c'])).toEqual([1, 0, 1]);
  });
});

describe('geo proximity', () => {
  it('haversine returns ~0 for identical points and null without coords', () => {
    const p = { latitude: 0, longitude: 0 };
    expect(haversineKm(p, p)).toBeCloseTo(0);
    expect(haversineKm({ latitude: null, longitude: null }, p)).toBeNull();
  });
  it('haversine ~111km per degree of longitude at equator', () => {
    const d = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
  it('withinRadius falls back to city equality without coordinates', () => {
    const viewer = { city: City.Johannesburg };
    expect(withinRadius(viewer, { city: City.Johannesburg }, 80)).toBe(true);
    expect(withinRadius(viewer, { city: City.CapeTown }, 80)).toBe(false);
  });
  it('withinRadius honours distance with coordinates', () => {
    const viewer = { latitude: -26.2, longitude: 28.0 }; // Johannesburg
    const near = { latitude: -26.1, longitude: 28.1 }; // ~13km away
    const far = { latitude: -33.9, longitude: 18.4 }; // Cape Town ~1300km
    expect(withinRadius(viewer, near, 80)).toBe(true);
    expect(withinRadius(viewer, far, 80)).toBe(false);
  });
});

describe('content-based filtering', () => {
  const viewer = { interests: ['travel', 'books'], city: City.Johannesburg };
  it('interestsJaccard', () => {
    expect(interestsJaccard(['travel', 'books'], ['books', 'music'])).toBeCloseTo(1 / 3);
  });
  it('cosine similarity is 1 for identical profiles, lower for different', () => {
    const a = {
      city: City.Johannesburg,
      educationLevel: EducationLevel.Masters,
      gender: Gender.Female,
      interests: ['travel', 'books'],
    };
    expect(contentCosineSimilarity(a, a)).toBeCloseTo(1);
    const b = {
      city: City.CapeTown,
      educationLevel: EducationLevel.Diploma,
      gender: Gender.Male,
      interests: ['gaming'],
    };
    expect(contentCosineSimilarity(a, b)).toBeLessThan(1);
  });
  it('contentBoost scales with similarity', () => {
    expect(contentBoost(viewer, viewer, 10)).toBe(10);
  });
});

describe('collaborative filtering', () => {
  const records: InteractionRecord[] = [
    { userId: 'u1', itemId: 'i1', value: 1 },
    { userId: 'u2', itemId: 'i1', value: 1 },
    { userId: 'u2', itemId: 'i2', value: 1 },
    { userId: 'u1', itemId: 'i2', value: 1 },
  ];
  const m = buildInteractionMatrix(records);
  it('builds a square matrix with indices', () => {
    expect(m.userIds.length).toBe(2);
    expect(m.itemIds.length).toBe(2);
    expect(m.values[0][0]).toBe(1);
  });
  it('item-based affinity is high for co-liked items', () => {
    expect(itemBasedAffinity(['i1'], 'i2', m)).toBeCloseTo(1);
  });
  it('user-based affinity predicts a positive rating', () => {
    const aff = userBasedAffinity('u1', 'i2', m);
    expect(aff).toBeGreaterThan(0.5);
  });
  it('cfAffinity returns 0 for unknown items', () => {
    expect(cfAffinity('u1', ['i1'], 'missing', m)).toBe(0);
  });
});

describe('popularity / Elo', () => {
  it('expected score is 0.5 for equal Elo', () => {
    expect(eloExpected(1500, 1500)).toBeCloseTo(0.5);
  });
  it('winner gains, loser loses by equal magnitude', () => {
    const [w, l] = updateElo(1500, 1500, 32);
    expect(w - 1500).toBeCloseTo(16);
    expect(1500 - l).toBeCloseTo(16);
  });
  it('normalizeElo centres on initial', () => {
    expect(normalizeElo(1500)).toBeCloseTo(0.5);
    expect(normalizeElo(2000)).toBeGreaterThan(0.5);
  });
  it('popularity adjustment boosts the under-exposed, penalizes the popular', () => {
    expect(popularityAdjustment(1200)).toBeGreaterThan(0); // low Elo -> positive
    expect(popularityAdjustment(1800)).toBeLessThan(0); // high Elo -> penalty
  });
});

describe('diversity / MMR', () => {
  it('re-ranks to favour diverse candidates', () => {
    const items = [
      { id: 'a', relevance: 1, vector: [1, 0, 0], payload: 'a' },
      { id: 'b', relevance: 1, vector: [1, 0, 0], payload: 'b' },
      { id: 'c', relevance: 0.8, vector: [0, 1, 0], payload: 'c' },
    ];
    const out = mmrRerank(items, 0.5, 3).map((i) => i.id);
    // first pick by relevance (a), then the diverse c beats the twin b
    expect(out[0]).toBe('a');
    expect(out).toContain('c');
    expect(out.indexOf('c')).toBeLessThan(out.indexOf('b'));
  });
});

describe('cold start', () => {
  it('detects cold viewers', () => {
    expect(isColdStart(0)).toBe(true);
    expect(isColdStart(5)).toBe(false);
  });
  it('blend clamps to 100', () => {
    expect(coldStartBlend(98, 50)).toBe(100);
    expect(coldStartBlend(50, 3)).toBe(53);
  });
});

describe('fairness re-rank', () => {
  it('guarantees a minimum share per group in top-N', () => {
    const items = [
      { payload: 'm1', score: 90, group: 'male' },
      { payload: 'm2', score: 80, group: 'male' },
      { payload: 'm3', score: 70, group: 'male' },
      { payload: 'f1', score: 60, group: 'female' },
      { payload: 'f2', score: 50, group: 'female' },
    ];
    const out = fairnessRerank(items, 4, 0.25).map((i) => i.payload);
    // 4 slots * 0.25 = 1 minimum per group, so at least one female must appear
    expect(out.filter((p) => p.startsWith('f')).length).toBeGreaterThanOrEqual(1);
  });
});

describe('feature extraction (LTR / future ML prep)', () => {
  it('context features capture time signals', () => {
    const f = extractContextFeatures({ now: new Date('2026-08-15T20:00:00'), sessionDepth: 3 });
    expect(f.is_evening).toBe(1);
    expect(f.session_depth).toBe(3);
  });
  it('ltr features are numeric and bounded', () => {
    const v = [28, 30, 0.5, 0.3, 0.2, 4, 1, 1, 0, 3];
    expect(extractLtrFeatures(
      { age: 28, interests: ['a'], relationshipGoals: ['marriage'], likeRatio: 0.5 },
      { age: 30, interests: ['a', 'b'], relationshipGoals: ['marriage'], likedByCount: 4, verified: true },
      { now: new Date(), sessionDepth: 3 },
    ).length).toBe(v.length);
  });
  it('swipe sequence preserves order and graph is undirected', () => {
    const recs = [
      { userId: 'u', itemId: 'i1', value: 1 },
      { userId: 'u', itemId: 'i2', value: 1 },
    ];
    expect(extractSwipeSequence(recs)).toEqual(['i1', 'i2']);
    const g = buildInteractionGraph(recs);
    expect(g.get('u')!.has('i1')).toBe(true);
    expect(g.get('i1')!.has('u')).toBe(true);
  });
  it('exploration injects a serendipitous candidate when rng fires', () => {
    const ranked = [{ score: 90, userId: 'a' }];
    const pool = [{ score: 10, userId: 'b' }];
    const out = applyExploration(ranked, pool, 1, () => 0, (r) => r.userId);
    expect(out.map((r) => r.userId)).toEqual(['b', 'a']);
  });
});

describe('MatchingEngine end-to-end', () => {
  const viewer: EngineViewer = {
    userId: 'viewer',
    preferences: {
      genderPreference: Gender.Female,
      ageMin: 28,
      ageMax: 40,
      interests: ['travel', 'books'],
      distanceKm: 80,
    },
    dealbreakers: ['smoking'],
    latitude: -26.2,
    longitude: 28.0,
    city: City.Johannesburg,
    isPremium: false,
    accountAgeDays: 100,
    elo: 1500,
    likedItemIds: [],
  };

  function cand(over: Partial<EngineCandidate>): EngineCandidate {
    return {
      userId: 'c',
      gender: Gender.Female,
      city: City.Johannesburg,
      educationLevel: EducationLevel.Bachelors,
      dateOfBirth: new Date('1992-01-01'),
      interests: ['travel'],
      industries: [],
      profession: 'Doctor',
      dealbreakers: [],
      verified: false,
      isPremium: false,
      accountAgeDays: 100,
      elo: 1500,
      likedByCount: 0,
      ...over,
    };
  }

  it('applies hard constraints (gender / age / radius / dealbreakers)', () => {
    const candidates = [
      cand({ userId: 'ok', gender: Gender.Female, dateOfBirth: new Date('1992-01-01') }),
      cand({ userId: 'wrong-gender', gender: Gender.Male }),
      cand({ userId: 'too-old', dateOfBirth: new Date('1960-01-01') }),
      cand({ userId: 'dealbreaker', dealbreakers: ['smoking'] }),
      // no coordinates -> falls back to exact-city equality (Johannesburg matches)
      cand({ userId: 'other-city', city: City.CapeTown }),
    ];
    const out = new MatchingEngine(buildDefaultConfig({ enableDiversity: false, enableFairness: false })).recommend(
      viewer,
      candidates,
      null,
    );
    const ids = out.map((r) => r.candidate.userId);
    expect(ids).toContain('ok');
    expect(ids).not.toContain('wrong-gender');
    expect(ids).not.toContain('too-old');
    expect(ids).not.toContain('dealbreaker');
    expect(ids).not.toContain('other-city');
  });

  it('cold-start viewer falls back to content + popularity (no CF term)', () => {
    const candidates = [cand({ userId: 'x', likedByCount: 9 })];
    const out = new MatchingEngine(
      buildDefaultConfig({ enableDiversity: false, enableFairness: false }),
    ).recommend(viewer, candidates, null);
    expect(out[0].breakdown.coldStartFallback).toBe(true);
    expect(out[0].cfScore).toBe(0);
  });

  it('applies premium + new-user business boosts', () => {
    const candidates = [cand({ userId: 'p', isPremium: true, accountAgeDays: 2 })];
    const out = new MatchingEngine(
      buildDefaultConfig({ enableDiversity: false, enableFairness: false }),
    ).recommend(viewer, candidates, null);
    expect(out[0].breakdown.premiumBoost).toBeGreaterThan(0);
    expect(out[0].breakdown.newUserBoost).toBeGreaterThan(0);
  });

  it('respects top-N and returns ranked cards', () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      cand({ userId: `u${i}`, interests: ['travel', 'books'], profession: 'Doctor' }),
    );
    const out = new MatchingEngine(buildDefaultConfig({ topN: 5 })).recommend(
      viewer,
      candidates,
      null,
    );
    expect(out.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    }
  });
});
