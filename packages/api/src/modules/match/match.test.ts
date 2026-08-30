import { scoreCompatibility, applyPenalties, passesThreshold, rankCandidates } from './scoring';
import {
  Gender,
  City,
  EducationLevel,
  RelationshipGoal,
  DISCOVER_PREVIEW_LIMIT,
  MIN_COMPATIBILITY_THRESHOLD,
} from '@africonnect/shared';
import { MatchCandidate } from './match.types';

const viewerPrefs = {
  educationMin: EducationLevel.Bachelors,
  professions: ['Doctor'],
  ageMin: 28,
  ageMax: 40,
  city: City.Johannesburg,
  relationshipGoals: [RelationshipGoal.Marriage],
};

function candidate(over: Partial<MatchCandidate>): MatchCandidate {
  return {
    userId: 'c1',
    gender: Gender.Female,
    city: City.Johannesburg,
    educationLevel: EducationLevel.Masters,
    dateOfBirth: new Date('1992-01-01'),
    relationshipGoals: RelationshipGoal.Marriage,
    interests: ['travel', 'books', 'music'],
    profession: 'Doctor',
    ...over,
  };
}

/** Date of birth for someone exactly `age` years old, relative to today.
 *  Fixtures that depend on an age band must be built this way — a hard-coded
 *  `new Date('1992-01-01')` silently drifts out of the 28..40 window as the
 *  calendar advances, and the age credit disappears with it. */
function dobAtAge(age: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d;
}

describe('rules-based compatibility scoring', () => {
  it('rewards every aligned dimension', () => {
    // education +30, profession +25, age +20, city +15, goals +10 = 100
    const score = scoreCompatibility({ preferences: viewerPrefs }, candidate({}));
    expect(score).toBe(100);
  });

  it('deducts for a non-matching city', () => {
    const score = scoreCompatibility(
      { preferences: viewerPrefs },
      candidate({ city: City.CapeTown }),
    );
    expect(score).toBe(85);
  });

  it('deducts for education below preference', () => {
    const score = scoreCompatibility(
      { preferences: viewerPrefs },
      candidate({ educationLevel: EducationLevel.Diploma }),
    );
    expect(score).toBe(70); // no education bonus
  });

  it('applies passed/blocked penalties', () => {
    expect(applyPenalties(100, { passed: true })).toBe(80);
    expect(applyPenalties(100, { blocked: true })).toBe(50);
  });

  it(`gates on the ${MIN_COMPATIBILITY_THRESHOLD}-point threshold`, () => {
    // Asserted against the shared constant (not a literal) so the test tracks
    // the threshold instead of drifting: commit 99f4495 lowered it from 60 to
    // 20 and this assertion kept asserting the retired value.
    expect(passesThreshold(MIN_COMPATIBILITY_THRESHOLD)).toBe(true);
    expect(passesThreshold(MIN_COMPATIBILITY_THRESHOLD - 1)).toBe(false);
  });

  it('ranks and filters candidates above threshold', () => {
    const candidates = [
      candidate({ userId: 'aaa', educationLevel: EducationLevel.Diploma }), // 70
      candidate({ userId: 'bbb', city: City.CapeTown }), // 85
      // Every dimension must miss for a candidate to fall under the threshold:
      // matching even the age band alone (20) would clear it.
      candidate({
        userId: 'ccc',
        educationLevel: EducationLevel.Diploma, // below Bachelors -> no education credit
        profession: 'Nurse', // not in viewer's professions
        city: City.CapeTown, // not Johannesburg
        dateOfBirth: dobAtAge(16), // outside the 28..40 band
        relationshipGoals: RelationshipGoal.Friendship, // not Marriage
        interests: [],
      }), // 0 -> dropped
    ];
    const ranked = rankCandidates({ preferences: viewerPrefs }, candidates);
    expect(ranked.length).toBe(2);
    expect(ranked[0].candidate.userId).toBe('bbb');
    expect(ranked[1].candidate.userId).toBe('aaa');
  });
});

// ── Full generateDailyMatches pipeline (fake repos) ──────────────────────────
import { MatchService } from './match.service';
import { MatchRepository } from './match.repository';
import { ProfileRepository } from '@modules/profile/profile.repository';

function fakeProfileRepo(over: Record<string, unknown> = {}) {
  return {
    findByUserId: async () => ({
      userId: 'viewer',
      isComplete: true,
      isPaused: false,
      preferences: {
        city: City.Johannesburg,
        genderPreference: Gender.Female,
        ageMin: 28,
        ageMax: 40,
      },
      ...over,
    }),
    findByUserIds: async () => [],
  } as unknown as ProfileRepository;
}

function fakeMatchRepo(candidates: unknown[], excludeIds: string[] = []) {
  return {
    findTodaysQueue: async () => null,
    getExcludedIds: async () => excludeIds,
    findMatchableCandidates: async () => candidates,
    createDailyQueue: async () => undefined,
    loadUserTier: async () => ({ isPremium: false, isVetted: true }),
  } as unknown as MatchRepository;
}

describe('MatchService.generateDailyMatches', () => {
  it('scores candidates, filters below threshold, and returns ranked entries', async () => {
    const candidates = [
      {
        userId: 'u1',
        gender: Gender.Female,
        city: City.Johannesburg,
        educationLevel: EducationLevel.Masters,
        dateOfBirth: dobAtAge(34),
        profession: 'Doctor',
        interests: ['travel', 'books'],
        preferences: {},
      },
      {
        userId: 'u2',
        gender: Gender.Female,
        city: City.CapeTown,
        educationLevel: EducationLevel.Masters,
        dateOfBirth: dobAtAge(34),
        profession: 'Doctor',
        interests: ['travel'],
        preferences: {},
      },
      {
        userId: 'u3',
        gender: Gender.Female,
        city: City.Johannesburg,
        educationLevel: EducationLevel.Diploma,
        dateOfBirth: dobAtAge(34),
        profession: 'Doctor',
        interests: [],
        preferences: {},
      },
      {
        userId: 'u4',
        gender: Gender.Female,
        city: City.CapeTown,
        educationLevel: EducationLevel.Diploma,
        dateOfBirth: dobAtAge(16),
        profession: 'Nurse',
        interests: [],
        preferences: {},
      },
    ];
    const service = new MatchService(
      fakeMatchRepo(candidates),
      fakeProfileRepo({
        preferences: {
          city: City.Johannesburg,
          genderPreference: Gender.Female,
          ageMin: 28,
          ageMax: 40,
          // An explicit education preference is required for this test to be
          // able to exercise the threshold at all. scoring.ts awards neutral
          // education credit when the viewer has no educationMin, which floors
          // every candidate at 30 — above the threshold no matter how badly
          // everything else misses.
          educationMin: EducationLevel.Masters,
        },
      }),
    );
    const { matches, cached } = await service.generateDailyMatches('viewer');
    expect(cached).toBe(false);
    // u1 = 30 edu + 20 age + 15 city = 65
    // u2 = 30 edu + 20 age + 0 city = 50
    // u3 = 0 edu + 20 age + 15 city = 35
    // u4 = 0 edu + 0 age (16, outside 28..40) + 0 city = 0 -> dropped
    expect(matches.length).toBe(3);
    expect(matches.map((m) => m.userId).sort()).toEqual(['u1', 'u2', 'u3']);
    expect(matches[0].score).toBe(65);
    expect(matches[1].score).toBe(50);
    expect(matches[2].score).toBe(35);
    expect(matches.map((m) => m.userId)).not.toContain('u4');
  });

  it('falls back to top-N when every candidate is below threshold', async () => {
    // generateDailyMatches never returns an empty deck: if the threshold
    // filters everything out it returns the best available instead.
    const candidates = [
      {
        userId: 'low1',
        gender: Gender.Female,
        city: City.CapeTown,
        educationLevel: EducationLevel.Diploma,
        dateOfBirth: dobAtAge(16),
        profession: 'Nurse',
        interests: [],
        preferences: {},
      },
    ];
    const service = new MatchService(
      fakeMatchRepo(candidates),
      fakeProfileRepo({
        preferences: {
          city: City.Johannesburg,
          genderPreference: Gender.Female,
          ageMin: 28,
          ageMax: 40,
          educationMin: EducationLevel.Masters,
        },
      }),
    );
    const { matches } = await service.generateDailyMatches('viewer');
    expect(matches.length).toBe(1);
    expect(matches[0].score).toBe(0);
  });

  it('returns the cached queue without recomputing', async () => {
    const service = new MatchService(
      {
        findTodaysQueue: async () => ({
          matches: [
            {
              userId: 'cached',
              score: 77,
              displayName: null,
              city: City.Johannesburg,
              educationLevel: EducationLevel.Bachelors,
              profession: null,
            },
          ],
          expiresAt: new Date(),
        }),
        getExcludedIds: async () => [],
        findMatchableCandidates: async () => {
          throw new Error('should not be called');
        },
        createDailyQueue: async () => undefined,
      } as unknown as MatchRepository,
      fakeProfileRepo(),
    );
    const { matches, cached } = await service.generateDailyMatches('viewer');
    expect(cached).toBe(true);
    expect(matches[0].userId).toBe('cached');
  });

  it('rejects a viewer with an incomplete profile', async () => {
    const service = new MatchService(fakeMatchRepo([]), fakeProfileRepo({ isComplete: false }));
    await expect(service.generateDailyMatches('viewer')).rejects.toThrow(/Complete your profile/);
  });
});

// ── discover vetting behaviour ─────────────────────────────────────────────
describe('MatchService.discover vetting behaviour', () => {
  it('rejects a viewer with an incomplete profile', async () => {
    const service = new MatchService(fakeMatchRepo([]), fakeProfileRepo({ isComplete: false }));
    await expect(service.discover('viewer', {})).rejects.toThrow(/Complete your profile/);
  });

  it('serves a capped, non-personalised preview to an un-vetted viewer (no 403)', async () => {
    const repo = {
      getExcludedIds: async () => [],
      loadUserTier: async () => ({ isPremium: false, isVetted: false }),
      loadAccountCreatedAt: async () => new Date(),
      getViewerLikes: async () => [],
      getInteractionSample: async () => [],
    } as unknown as MatchRepository;
    const findMatchableCandidates = jest.fn(async () => [
      { id: 'p1', userId: 'u1', displayName: 'A', photos: [], user: { emailVerified: true, phoneVerified: true } },
      { id: 'p2', userId: 'u2', displayName: 'B', photos: [], user: { emailVerified: true, phoneVerified: true } },
    ]);
    const service = new MatchService(
      { ...repo, findMatchableCandidates } as unknown as MatchRepository,
      fakeProfileRepo(),
    );
    const cards = await service.discover('viewer', {});
    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBeLessThanOrEqual(DISCOVER_PREVIEW_LIMIT);
  });
});
