import { scoreCompatibility, applyPenalties, passesThreshold, rankCandidates } from './scoring';
import { Gender, City, EducationLevel, RelationshipGoal, DISCOVER_PREVIEW_LIMIT } from '@africonnect/shared';
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

  it('gates on the 60-point threshold', () => {
    expect(passesThreshold(60)).toBe(true);
    expect(passesThreshold(59)).toBe(false);
  });

  it('ranks and filters candidates above threshold', () => {
    const candidates = [
      candidate({ userId: 'aaa', educationLevel: EducationLevel.Diploma }), // 70
      candidate({ userId: 'bbb', city: City.CapeTown }), // 85
      candidate({ userId: 'ccc', educationLevel: EducationLevel.Diploma, city: City.CapeTown }), // 55 -> dropped
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
import { Gender, City, EducationLevel } from '@africonnect/shared';

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
        dateOfBirth: new Date('1992-01-01'),
        profession: 'Doctor',
        interests: ['travel', 'books'],
        preferences: {},
      },
      {
        userId: 'u2',
        gender: Gender.Female,
        city: City.CapeTown,
        educationLevel: EducationLevel.Masters,
        dateOfBirth: new Date('1992-01-01'),
        profession: 'Doctor',
        interests: ['travel'],
        preferences: {},
      },
      {
        userId: 'u3',
        gender: Gender.Female,
        city: City.Johannesburg,
        educationLevel: EducationLevel.Diploma,
        dateOfBirth: new Date('1992-01-01'),
        profession: 'Doctor',
        interests: [],
        preferences: {},
      },
    ];
    const service = new MatchService(fakeMatchRepo(candidates), fakeProfileRepo());
    const { matches, cached } = await service.generateDailyMatches('viewer');
    expect(cached).toBe(false);
    // u1 (Joburg, +30 neutral edu, +20 age, +15 city = 65) and
    // u3 (Joburg, +30 neutral edu, +20 age, +15 city = 65) pass; u2 (CapeTown) = 50 -> dropped.
    expect(matches.length).toBe(2);
    expect(matches.map((m) => m.userId).sort()).toEqual(['u1', 'u3']);
    expect(matches[0].score).toBe(65);
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
