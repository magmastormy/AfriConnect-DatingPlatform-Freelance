import { PrismaClient, Prisma, AdminAudit } from '@prisma/client';
import {
  InternalError,
  UserRole,
  UserStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  AdminScope,
  asEnum,
} from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import { MemberView, MemberDetail, AdminAuditView } from './admin.types';

export interface ListMembersFilter {
  status?: UserStatus;
  role?: UserRole;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IAdminRepository {
  dashboard(): Promise<{
    applicationsPending: number;
    applicationsUnderReview: number;
    membersActive: number;
    membersSuspended: number;
    eventsPublished: number;
    eventsDraft: number;
    revenueZar: number;
    mrrZar: number;
    subscriptionsActive: number;
  }>;
  listMembers(filter: ListMembersFilter): Promise<MemberView[]>;
  countMembers(filter: ListMembersFilter): Promise<number>;
  getMemberDetail(userId: string): Promise<MemberDetail | null>;
  setRole(userId: string, role: UserRole): Promise<void>;
  setStatus(userId: string, status: UserStatus): Promise<void>;
  setVerification(
    userId: string,
    fields: { emailVerified?: boolean; phoneVerified?: boolean },
  ): Promise<void>;
  listAdmins(): Promise<MemberView[]>;
  audit(input: {
    adminId: string;
    action: string;
    entity: string;
    entityId?: string | null;
    scope: AdminScope;
    metadata?: unknown;
    ipAddress?: string | null;
  }): Promise<void>;
  listAudit(limit: number): Promise<AdminAuditView[]>;
}

const MEMBER_SELECT = {
  id: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  emailVerified: true,
  phoneVerified: true,
  createdAt: true,
  profile: { select: { firstName: true, lastName: true, city: true, isComplete: true } },
} as const;

export class AdminRepository implements IAdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async dashboard() {
    try {
      const [
        applicationsPending,
        applicationsUnderReview,
        membersActive,
        membersSuspended,
        eventsPublished,
        eventsDraft,
        succeededPayments,
        activeSubs,
      ] = await Promise.all([
        this.prisma.application.count({ where: { status: 'submitted' } }),
        this.prisma.application.count({ where: { status: 'under_review' } }),
        this.prisma.user.count({
          where: { status: 'active', role: { in: ['member', 'premium'] } },
        }),
        this.prisma.user.count({ where: { status: 'suspended' } }),
        this.prisma.event.count({ where: { status: 'published' } }),
        this.prisma.event.count({ where: { status: 'draft' } }),
        this.prisma.payment.findMany({ where: { status: 'succeeded' }, select: { amount: true } }),
        this.prisma.subscription.findMany({
          where: { status: 'active' },
          select: { currentPeriodEnd: true, plan: true },
        }),
      ]);

      const revenueZar = succeededPayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
      // MRR ≈ sum of active monthly-equivalent plan prices (ZAR) still in period.
      const planMonthlyZar: Record<string, number> = {
        digital_access: 0,
        premium: 299,
        platinum: 599,
      };
      const mrrZar = activeSubs
        .filter((s) => !s.currentPeriodEnd || s.currentPeriodEnd > new Date())
        .reduce((sum, s) => sum + (planMonthlyZar[s.plan] ?? 0), 0);

      return {
        applicationsPending,
        applicationsUnderReview,
        membersActive,
        membersSuspended,
        eventsPublished,
        eventsDraft,
        revenueZar,
        mrrZar,
        subscriptionsActive: activeSubs.length,
      };
    } catch (error) {
      logger.error({ error }, 'AdminRepository: dashboard failed');
      throw new InternalError('Could not load admin dashboard');
    }
  }

  async listMembers(filter: ListMembersFilter): Promise<MemberView[]> {
    const where = this.memberWhere(filter);
    const rows = await this.prisma.user.findMany({
      where,
      select: MEMBER_SELECT,
      skip: ((filter.page ?? 1) - 1) * (filter.limit ?? 25),
      take: filter.limit ?? 25,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toMemberView(r));
  }

  async countMembers(filter: ListMembersFilter): Promise<number> {
    return this.prisma.user.count({ where: this.memberWhere(filter) });
  }

  async getMemberDetail(userId: string): Promise<MemberDetail | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        subscriptions: true,
        applications: { select: { id: true, status: true, createdAt: true } },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: asEnum<UserRole>(user.role),
      status: asEnum<UserStatus>(user.status),
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      firstName: user.profile?.firstName ?? null,
      lastName: user.profile?.lastName ?? null,
      city: user.profile?.city ? asEnum<MemberView['city']>(user.profile.city) : null,
      isComplete: user.profile?.isComplete ?? null,
      profile: user.profile,
      subscription: user.subscriptions
        ? {
            plan: asEnum<SubscriptionPlan>(user.subscriptions.plan),
            status: asEnum<SubscriptionStatus>(user.subscriptions.status),
            currentPeriodEnd: user.subscriptions.currentPeriodEnd,
          }
        : null,
      applications: user.applications.map((a) => ({
        id: a.id,
        status: asEnum<MemberDetail['applications'][number]['status']>(a.status),
        createdAt: a.createdAt,
      })),
    };
  }

  async setRole(userId: string, role: UserRole): Promise<void> {
    await this.updateUser(userId, { role: role as Prisma.UserUpdateInput['role'] });
  }

  async setStatus(userId: string, status: UserStatus): Promise<void> {
    await this.updateUser(userId, { status: status as Prisma.UserUpdateInput['status'] });
  }

  async setVerification(
    userId: string,
    fields: { emailVerified?: boolean; phoneVerified?: boolean },
  ): Promise<void> {
    await this.updateUser(userId, {
      ...(fields.emailVerified !== undefined ? { emailVerified: fields.emailVerified } : {}),
      ...(fields.phoneVerified !== undefined ? { phoneVerified: fields.phoneVerified } : {}),
    });
  }

  async listAdmins(): Promise<MemberView[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        role: {
          in: [
            'admin',
            'admin_vetting',
            'admin_events',
            'admin_billing',
            'admin_support',
            'admin_content',
            'superadmin',
          ],
        },
      },
      select: MEMBER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toMemberView(r));
  }

  async audit(input: {
    adminId: string;
    action: string;
    entity: string;
    entityId?: string | null;
    scope: AdminScope;
    metadata?: unknown;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.adminAudit.create({
        data: {
          adminId: input.adminId,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          scope: input.scope as Prisma.AdminAuditCreateInput['scope'],
          metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (error) {
      // Audit failures must never break the admin operation itself.
      logger.error(
        { error, adminId: input.adminId, action: input.action },
        'AdminRepository: audit write failed',
      );
    }
  }

  async listAudit(limit: number): Promise<AdminAuditView[]> {
    const rows = await this.prisma.adminAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((a: AdminAudit) => ({
      id: a.id,
      adminId: a.adminId,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      scope: asEnum<AdminScope>(a.scope),
      metadata: a.metadata,
      ipAddress: a.ipAddress,
      createdAt: a.createdAt,
    }));
  }

  private memberWhere(filter: ListMembersFilter): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (filter.status) where.status = filter.status as Prisma.UserWhereInput['status'];
    if (filter.role) where.role = filter.role as Prisma.UserWhereInput['role'];
    if (filter.search) {
      where.OR = [
        { email: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search } },
        { profile: { firstName: { contains: filter.search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  private async updateUser(userId: string, data: Prisma.UserUpdateInput): Promise<void> {
    try {
      await this.prisma.user.update({ where: { id: userId }, data });
    } catch (error) {
      logger.error({ error, userId }, 'AdminRepository: updateUser failed');
      throw new InternalError('Could not update user', { userId });
    }
  }

  private toMemberView(r: {
    id: string;
    email: string;
    phone: string;
    role: unknown;
    status: unknown;
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: Date;
    profile?: {
      firstName: string | null;
      lastName: string | null;
      city: unknown;
      isComplete: boolean | null;
    } | null;
  }): MemberView {
    return {
      id: r.id,
      email: r.email,
      phone: r.phone,
      role: asEnum<UserRole>(r.role),
      status: asEnum<UserStatus>(r.status),
      emailVerified: r.emailVerified,
      phoneVerified: r.phoneVerified,
      createdAt: r.createdAt,
      firstName: r.profile?.firstName ?? null,
      lastName: r.profile?.lastName ?? null,
      city: r.profile?.city ? asEnum<MemberView['city']>(r.profile.city) : null,
      isComplete: r.profile?.isComplete ?? null,
    };
  }
}
