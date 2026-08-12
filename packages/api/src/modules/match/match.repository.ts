import { Prisma, PrismaClient, Match } from '@prisma/client';
import { InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import { DailyMatchEntry } from './match.types';

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
  createDailyQueue(userId: string, matches: DailyMatchEntry[]): Promise<void>;
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

  async createDailyQueue(userId: string, matches: DailyMatchEntry[]): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.dailyMatchQueue.create({
      data: { userId, matches: matches as unknown as Prisma.InputJsonValue, expiresAt },
    });
  }
}
