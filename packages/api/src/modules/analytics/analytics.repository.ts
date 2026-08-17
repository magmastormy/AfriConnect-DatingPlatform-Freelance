import { PrismaClient, MatchAction, MatchStatus, RSVPStatus } from '@prisma/client';
import { InternalError, logger } from '@africonnect/shared';
import { PROFILE_VIEW_COOLDOWN_HOURS } from '@africonnect/shared';
import { AnalyticsBundle, Bucket } from './analytics.types';

export interface IAnalyticsRepository {
  recordView(viewerId: string, viewedUserId: string): Promise<boolean>;
  getBundle(userId: string, windowDays: 7 | 30 | 90): Promise<AnalyticsBundle>;
}

/**
 * Aggregates member-facing analytics (Change C). Reads are scoped per member and
 * bucketed by UTC day so charts have evenly spaced, gap-filled series.
 */
export class AnalyticsRepository implements IAnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Records a profile view unless it's a self-view or a duplicate within the
   * cooldown window (server-side de-duplication — AGENTS.md §9.3).
   */
  async recordView(viewerId: string, viewedUserId: string): Promise<boolean> {
    if (viewerId === viewedUserId) return false;
    const since = new Date(Date.now() - PROFILE_VIEW_COOLDOWN_HOURS * 60 * 60 * 1000);
    const recent = await this.prisma.profileView.findFirst({
      where: { viewerId, viewedUserId, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) return false;
    await this.prisma.profileView.create({ data: { viewerId, viewedUserId } });
    return true;
  }

  private dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private bucketize(dates: Date[], start: Date, windowDays: number): Bucket[] {
    const buckets: Bucket[] = [];
    const index = new Map<string, number>();
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = this.dayKey(d);
      index.set(key, buckets.length);
      buckets.push({ date: key, count: 0 });
    }
    for (const dt of dates) {
      const idx = index.get(this.dayKey(dt));
      if (idx !== undefined) buckets[idx].count++;
    }
    return buckets;
  }

  async getBundle(userId: string, windowDays: 7 | 30 | 90): Promise<AnalyticsBundle> {
    try {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - (windowDays - 1));
      const end = new Date();
      const range = { gte: start };

      const [profileViews, likesSent, likesReceived, mutualMatches, eventsRsvpd] =
        await Promise.all([
          this.prisma.profileView.findMany({
            where: { viewedUserId: userId, createdAt: range },
            select: { createdAt: true },
          }),
          this.prisma.match.findMany({
            where: {
              userId,
              userAction: { in: [MatchAction.liked, MatchAction.superliked] },
              createdAt: range,
            },
            select: { createdAt: true },
          }),
          this.prisma.match.findMany({
            where: {
              matchedUserId: userId,
              matchedUserAction: { in: [MatchAction.liked, MatchAction.superliked] },
              createdAt: range,
            },
            select: { createdAt: true },
          }),
          this.prisma.match.findMany({
            where: {
              OR: [{ userId }, { matchedUserId: userId }],
              status: MatchStatus.mutual,
              createdAt: range,
            },
            select: { createdAt: true },
          }),
          this.prisma.rSVP.findMany({
            where: { userId, status: { not: RSVPStatus.cancelled }, createdAt: range },
            select: { createdAt: true },
          }),
        ]);

      const profileViewsB = this.bucketize(
        profileViews.map((x) => x.createdAt),
        start,
        windowDays,
      );
      const likesSentB = this.bucketize(
        likesSent.map((x) => x.createdAt),
        start,
        windowDays,
      );
      const likesReceivedB = this.bucketize(
        likesReceived.map((x) => x.createdAt),
        start,
        windowDays,
      );
      const mutualMatchesB = this.bucketize(
        mutualMatches.map((x) => x.createdAt),
        start,
        windowDays,
      );
      const eventsRsvpdB = this.bucketize(
        eventsRsvpd.map((x) => x.createdAt),
        start,
        windowDays,
      );

      const sum = (b: Bucket[]) => b.reduce((acc, x) => acc + x.count, 0);

      return {
        windowDays,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        series: {
          profileViews: profileViewsB,
          likesSent: likesSentB,
          likesReceived: likesReceivedB,
          mutualMatches: mutualMatchesB,
          eventsRsvpd: eventsRsvpdB,
        },
        totals: {
          profileViews: sum(profileViewsB),
          likesSent: sum(likesSentB),
          likesReceived: sum(likesReceivedB),
          mutualMatches: sum(mutualMatchesB),
          eventsRsvpd: sum(eventsRsvpdB),
        },
      };
    } catch (error) {
      // The original error must be logged here: InternalError only carries the
      // sanitised message/context sent to the client, so discarding `error` made
      // every analytics failure unobservable in production.
      logger.error({ error, userId, windowDays }, 'AnalyticsRepository: getBundle failed');
      throw new InternalError('Failed to compute analytics', { userId, windowDays });
    }
  }
}
