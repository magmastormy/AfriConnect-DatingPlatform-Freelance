import { Prisma, PrismaClient, Subscription } from '@prisma/client';
import { InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';

export interface IBillingRepository {
  upsertSubscription(data: Record<string, unknown>): Promise<Subscription>;
  updateStatus(
    userId: string,
    data: { status: unknown; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: Date | null },
  ): Promise<Subscription>;
  getByUser(userId: string): Promise<Subscription | null>;
  listForAdmin(status?: unknown): Promise<(Subscription & { user: { email: string } | null })[]>;
  grant(userId: string, data: { plan: unknown; currentPeriodEnd: Date }): Promise<Subscription>;
}

export class BillingRepository implements IBillingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertSubscription(data: Record<string, unknown>): Promise<Subscription> {
    const userId = data.userId as string;
    try {
      const existing = await this.prisma.subscription.findUnique({ where: { userId } });
      if (existing) {
        return await this.prisma.subscription.update({
          where: { userId },
          data: data as Prisma.SubscriptionUncheckedUpdateInput,
        });
      }
      return await this.prisma.subscription.create({
        data: data as Prisma.SubscriptionUncheckedCreateInput,
      });
    } catch (error) {
      logger.error({ error, userId }, 'BillingRepository: upsertSubscription failed');
      throw new InternalError('Could not persist subscription');
    }
  }

  async updateStatus(
    userId: string,
    data: { status: unknown; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: Date | null },
  ): Promise<Subscription> {
    try {
      return await this.prisma.subscription.update({
        where: { userId },
        data: {
          status: data.status as Subscription['status'],
          cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
          currentPeriodEnd: data.currentPeriodEnd,
        },
      });
    } catch (error) {
      logger.error({ error, userId }, 'BillingRepository: updateStatus failed');
      throw new InternalError('Could not update subscription status');
    }
  }

  async getByUser(userId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  async listForAdmin(
    status?: unknown,
  ): Promise<(Subscription & { user: { email: string } | null })[]> {
    try {
      return (await this.prisma.subscription.findMany({
        where: status ? { status: status as Subscription['status'] } : undefined,
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })) as (Subscription & { user: { email: string } | null })[];
    } catch (error) {
      logger.error({ error }, 'BillingRepository: listForAdmin failed');
      throw new InternalError('Could not list subscriptions');
    }
  }

  async grant(
    userId: string,
    data: { plan: unknown; currentPeriodEnd: Date },
  ): Promise<Subscription> {
    try {
      return await this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: data.plan as Subscription['plan'],
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: data.currentPeriodEnd,
        },
        update: {
          plan: data.plan as Subscription['plan'],
          status: 'active',
          currentPeriodEnd: data.currentPeriodEnd,
        },
      });
    } catch (error) {
      logger.error({ error, userId }, 'BillingRepository: grant failed');
      throw new InternalError('Could not grant subscription');
    }
  }
}
