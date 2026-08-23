import { Prisma, PrismaClient, Match } from '@prisma/client';
import { InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import { DailyMatchEntry } from './match.types';
import { InteractionRecord } from './collaborative';
import { ELO_INITIAL } from '@africonnect/shared';

/** A user's effective tier, derived from their subscription + vetting status. */
export interface TierContext {
  isPremium: boolean;
  isVetted: boolean;
}

export interface IMatchRepository {
  findTodaysQueue(userId: string): Promise<{ matches: DailyMatchEntry[]; expiresAt: Date } | null>;
  findMatchableCandidates(
    where: Prisma.ProfileWhereInput,
    pagination: { skip: number; take: number },
  ): Promise<import('@prisma/client').Profile[]>;
  getExcludedIds(userId: string): Promise<string[]>;
  findActionBetween(a: string, b: string): Promise<Match | null>;
  upsertAction(
    userId: string,
    targetId: string,
    action: 'liked' | 'passed' | 'superliked',
    score?: number | null,
  ): Promise<Match>;
  findMutual(userId: string): Promise<Match[]>;
  /** Superlikes the caller has RECEIVED but not yet reciprocated (pending). */
  findSuperlikesReceived(userId: string): Promise<Match[]>;
  /** Fetch a single Match row by id (used to resolve the matchId envelope). */
  findById(id: string): Promise<Match | null>;
  createDailyQueue(userId: string, matches: DailyMatchEntry[]): Promise<void>;
  /** Resolves a user's membership tier (free vs premium) and vetting status. */
  loadUserTier(userId: string): Promise<TierContext>;
  /** Counts the caller's mutual connections with premium+vetted members. */
  countPremiumVettedConnections(userId: string): Promise<number>;
  /** Raw interaction sample used to build the collaborative-filtering matrix. */
  getInteractionSample(limit: number): Promise<InteractionRecord[]>;
  /** Ids of profiles the viewer has liked / superliked (drives item-based CF). */
  getViewerLikes(userId: string): Promise<string[]>;
  /** The viewer's account creation date (for new-user boost). */
  loadAccountCreatedAt(userId: string): Promise<Date | null>;
  /**
   * Per-candidate metadata for scoring (account age + how often liked).
   * TODO(popularity): replace the Elo default with a persisted `popularityElo`
   * column once the like-event updater (popularity.ts updateElo) is wired in.
   */
  getCandidateMeta(
    itemIds: string[],
  ): Promise<Map<string, { accountAgeDays: number; likedByCount: number; elo: number }>>;
}

export class MatchRepository implements IMatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findTodaysQueue(
    userId: string,
  ): Promise<{ matches: DailyMatchEntry[]; expiresAt: Date } | null> {
    const queue = await this.prisma.dailyMatchQueue.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { generatedAt: 'desc' },
    });
    if (!queue) return null;
    return {
      matches: (queue.matches as unknown as DailyMatchEntry[]) ?? [],
      expiresAt: queue.expiresAt,
    };
  }

  async findMatchableCandidates(
    where: Prisma.ProfileWhereInput,
    { skip, take }: { skip: number; take: number },
  ): Promise<
    (import('@prisma/client').Profile & {
      user: {
        emailVerified: boolean;
        phoneVerified: boolean;
        subscriptions: { plan: string } | null;
      };
    })[]
  > {
    return this.prisma.profile.findMany({
      where,
      orderBy: { completenessScore: 'desc' },
      skip,
      take,
      include: {
        user: {
          select: {
            emailVerified: true,
            phoneVerified: true,
            subscriptions: { select: { plan: true } },
          },
        },
      },
    });
  }

  /** Ids the viewer must never see again: self, passed, matched. */
  async getExcludedIds(userId: string): Promise<string[]> {
    const [passed, matched] = await Promise.all([
      this.prisma.match.findMany({
        where: { userId, status: 'passed' },
        select: { matchedUserId: true },
      }),
      this.prisma.match.findMany({
        where: { userId, status: 'mutual' },
        select: { matchedUserId: true },
      }),
    ]);
    return [userId, ...passed.map((r) => r.matchedUserId), ...matched.map((r) => r.matchedUserId)];
  }

  async findActionBetween(a: string, b: string): Promise<Match | null> {
    return this.prisma.match.findFirst({
      where: {
        OR: [
          { userId: a, matchedUserId: b },
          { userId: b, matchedUserId: a },
        ],
      },
    });
  }

  async upsertAction(
    userId: string,
    targetId: string,
    action: 'liked' | 'passed' | 'superliked',
    score?: number | null,
  ): Promise<Match> {
    const existing = await this.findActionBetween(userId, targetId);

    // Mutual when the other party already liked/superliked this viewer.
    const other = await this.prisma.match.findFirst({
      where: { userId: targetId, matchedUserId: userId },
    });
    const isMutual =
      (action === 'liked' || action === 'superliked') &&
      (other?.userAction === 'liked' || other?.userAction === 'superliked');

    const status: 'liked' | 'passed' | 'mutual' =
      action === 'passed' ? 'passed' : isMutual ? 'mutual' : 'liked';

    try {
      if (existing) {
        return await this.prisma.match.update({
          where: { id: existing.id },
          data: {
            userAction: action,
            matchedUserAction: other?.userAction ?? null,
            status,
            compatibilityScore: score ?? existing.compatibilityScore,
            matchedAt: isMutual ? new Date() : null,
          },
        });
      }
      return await this.prisma.match.create({
        data: {
          userId,
          matchedUserId: targetId,
          userAction: action,
          matchedUserAction: other?.userAction ?? null,
          status,
          compatibilityScore: score ?? null,
          matchedAt: isMutual ? new Date() : null,
        },
      });
    } catch (error) {
      logger.error({ error, userId, targetId }, 'MatchRepository: upsertAction failed');
      throw new InternalError('Match action failed');
    }
  }

  async findMutual(userId: string): Promise<Match[]> {
    return this.prisma.match.findMany({ where: { userId, status: 'mutual' } });
  }

  async findSuperlikesReceived(userId: string): Promise<Match[]> {
    // The caller is the *target* (matchedUserId). A pending superlike-received
    // is a row where someone else superliked them and the status has not yet
    // become mutual. Sender identity is intentionally never returned (POPIA).
    return this.prisma.match.findMany({
      where: { matchedUserId: userId, userAction: 'superliked', status: { not: 'mutual' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Match | null> {
    return this.prisma.match.findUnique({ where: { id } });
  }

  async createDailyQueue(userId: string, matches: DailyMatchEntry[]): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.dailyMatchQueue.create({
      data: { userId, matches: matches as unknown as Prisma.InputJsonValue, expiresAt },
    });
  }

  async loadUserTier(userId: string): Promise<TierContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        role: true,
        subscriptions: { select: { plan: true, status: true } },
      },
    });
    if (!user) return { isPremium: false, isVetted: false };
    const isVetted =
      (user.role === 'member' || user.role === 'premium') && user.status === 'active';
    const sub = user.subscriptions;
    const isPremium = Boolean(
      sub &&
      (sub.plan === 'premium' || sub.plan === 'platinum') &&
      (sub.status === 'active' || sub.status === 'trialing'),
    );
    return { isPremium, isVetted };
  }

  async countPremiumVettedConnections(userId: string): Promise<number> {
    const mutual = await this.prisma.match.findMany({
      where: { userId, status: 'mutual' },
      select: { matchedUserId: true },
    });
    const ids = mutual.map((m) => m.matchedUserId);
    if (!ids.length) return 0;
    // Premium + vetted counterpart: active member/premium role, an active/trialing
    // premium or platinum subscription.
    return this.prisma.user.count({
      where: {
        id: { in: ids },
        status: 'active',
        role: { in: ['member', 'premium'] },
        subscriptions: {
          plan: { in: ['premium', 'platinum'] },
          status: { in: ['active', 'trialing'] },
        },
      },
    });
  }

  async getInteractionSample(limit: number): Promise<InteractionRecord[]> {
    const rows = await this.prisma.match.findMany({
      where: { userAction: { in: ['liked', 'superliked', 'passed'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { userId: true, matchedUserId: true, userAction: true },
    });
    return rows.map((r) => ({
      userId: r.userId,
      itemId: r.matchedUserId,
      value: r.userAction === 'passed' ? -1 : r.userAction === 'superliked' ? 2 : 1,
    }));
  }

  async getViewerLikes(userId: string): Promise<string[]> {
    const rows = await this.prisma.match.findMany({
      where: { userId, userAction: { in: ['liked', 'superliked'] } },
      select: { matchedUserId: true },
    });
    return rows.map((r) => r.matchedUserId);
  }

  async loadAccountCreatedAt(userId: string): Promise<Date | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    return user?.createdAt ?? null;
  }

  async getCandidateMeta(
    itemIds: string[],
  ): Promise<Map<string, { accountAgeDays: number; likedByCount: number; elo: number }>> {
    const result = new Map<string, { accountAgeDays: number; likedByCount: number; elo: number }>();
    if (itemIds.length === 0) return result;

    const users = await this.prisma.user.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, createdAt: true },
    });
    const now = Date.now();
    const ageDays = new Map(
      users.map((u) => [u.id, Math.max(0, Math.floor((now - u.createdAt.getTime()) / 86_400_000))]),
    );

    const likes = await this.prisma.match.groupBy({
      by: ['matchedUserId'],
      where: { matchedUserId: { in: itemIds }, userAction: { in: ['liked', 'superliked'] } },
      _count: true,
    });

    for (const id of itemIds) {
      result.set(id, {
        accountAgeDays: ageDays.get(id) ?? 0,
        likedByCount: likes.find((l) => l.matchedUserId === id)?._count ?? 0,
        elo: ELO_INITIAL, // TODO(popularity): read persisted popularityElo
      });
    }
    return result;
  }
}
