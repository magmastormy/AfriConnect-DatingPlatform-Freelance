import { IAdminRepository, ListMembersFilter } from './admin.repository';
import {
  AdminDashboard,
  MemberView,
  MemberDetail,
  ApplicationAdminView,
  SubscriptionAdminView,
  AdminAuditView,
  RoleDescriptor,
  RoleAssignment,
  GlobalSearchResult,
} from './admin.types';
import { IApplicationService } from '@modules/application/application.service';
import { IEventService } from '@modules/event/event.service';
import { IBillingService } from '@modules/billing/billing.service';
import { INotificationService } from '@modules/notification/notification.service';
import { IMediaStorage } from '@africonnect/shared';
import {
  AuthedUser,
  UserRole,
  UserStatus,
  ApplicationStatus,
  AdminScope,
  SubscriptionPlan,
  asEnum,
} from '@africonnect/shared';
import { NotFoundError, ConflictError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';

export interface ReviewApplicationInput {
  status: ApplicationStatus;
  adminNotes?: string;
}

export interface ModerateMemberInput {
  reason?: string;
}

export interface CancelSubscriptionInput {
  atPeriodEnd: boolean;
  reason?: string;
}

export interface GrantSubscriptionInput {
  plan: SubscriptionPlan;
  months: number;
  reason?: string;
}

export interface EventModerationInput {
  status?: unknown;
  featured?: boolean;
  reason?: string;
}

export interface BroadcastInput {
  type: string;
  title: string;
  body: string;
  channel: unknown;
  role?: UserRole;
  /** Optional in-app destination rendered as a CTA button in the bell. */
  link?: string;
  data?: Record<string, unknown>;
}

/** Static description of which scopes each role grants (SuperAdmin tooling). */
export const ROLE_MATRIX: RoleDescriptor[] = [
  {
    role: UserRole.SuperAdmin,
    label: 'Super Admin',
    scopes: [
      AdminScope.Vetting,
      AdminScope.Events,
      AdminScope.Billing,
      AdminScope.Support,
      AdminScope.Content,
      AdminScope.Super,
    ],
  },
  {
    role: UserRole.Admin,
    label: 'General Admin',
    scopes: [
      AdminScope.Vetting,
      AdminScope.Events,
      AdminScope.Billing,
      AdminScope.Support,
      AdminScope.Content,
    ],
  },
  { role: UserRole.AdminVetting, label: 'Vetting Admin', scopes: [AdminScope.Vetting] },
  { role: UserRole.AdminEvents, label: 'Events Admin', scopes: [AdminScope.Events] },
  { role: UserRole.AdminBilling, label: 'Billing Admin', scopes: [AdminScope.Billing] },
  { role: UserRole.AdminSupport, label: 'Support Admin', scopes: [AdminScope.Support] },
  { role: UserRole.AdminContent, label: 'Content Admin', scopes: [AdminScope.Content] },
];

export interface IAdminService {
  dashboard(): Promise<AdminDashboard>;
  listApplications(status?: ApplicationStatus): Promise<ApplicationAdminView[]>;
  reviewApplication(
    id: string,
    input: ReviewApplicationInput,
    admin: AuthedUser,
  ): Promise<ApplicationAdminView>;
  listMembers(filter: ListMembersFilter): Promise<{ items: MemberView[]; total: number }>;
  getMember(userId: string): Promise<MemberDetail>;
  suspendMember(userId: string, admin: AuthedUser, input: ModerateMemberInput): Promise<void>;
  unsuspendMember(userId: string, admin: AuthedUser): Promise<void>;
  banMember(userId: string, admin: AuthedUser, input: ModerateMemberInput): Promise<void>;
  unbanMember(userId: string, admin: AuthedUser): Promise<void>;
  verifyMember(
    userId: string,
    fields: { emailVerified?: boolean; phoneVerified?: boolean },
    admin: AuthedUser,
  ): Promise<void>;
  listAdmins(): Promise<MemberView[]>;
  assignRole(userId: string, assignment: RoleAssignment, admin: AuthedUser): Promise<void>;
  roleMatrix(): RoleDescriptor[];
  listSubscriptions(status?: unknown): Promise<SubscriptionAdminView[]>;
  cancelSubscription(
    userId: string,
    input: CancelSubscriptionInput,
    admin: AuthedUser,
  ): Promise<void>;
  grantSubscription(
    userId: string,
    input: GrantSubscriptionInput,
    admin: AuthedUser,
  ): Promise<void>;
  listEvents(): Promise<unknown[]>;
  moderateEvent(id: string, input: EventModerationInput, admin: AuthedUser): Promise<unknown>;
  broadcast(input: BroadcastInput, admin: AuthedUser): Promise<{ queued: number }>;
  listAudit(limit?: number): Promise<AdminAuditView[]>;
  search(q: string): Promise<GlobalSearchResult>;
}

export class AdminService implements IAdminService {
  constructor(
    private readonly repo: IAdminRepository,
    private readonly applications: IApplicationService,
    private readonly events: IEventService,
    private readonly billing: IBillingService,
    private readonly notifications: INotificationService,
    private readonly storage: IMediaStorage,
  ) {}

  /**
   * Wraps a stored file URL into a browser-loadable URL.
   *
   * The application rows store whatever URL the upload pipeline returned at the
   * time the member submitted their documents. For private buckets (R2) the
   * stored URL is a public-shaped R2 URL that the browser cannot GET unsigned —
   * R2 replies with `<Error><Code>InvalidArgument</Code><Message>Authorization…
   * </Error>`. We sign on the way out so the admin "view" link actually works.
   *
   * - Local: stored URL is `/uploads/<key>` → already served by the API's static
   *   `/uploads` route, so we leave it alone.
   * - Cloudinary: stored URL is the public secure_url → leave it alone.
   * - R2: extract the object key, mint a 1-hour SigV4 presigned URL.
   */
  private async withSignedUrl(url: string | undefined | null): Promise<string | undefined> {
    if (!url) return undefined;
    // Local storage: served by static `/uploads`. Leave untouched.
    if (url.startsWith('/uploads/')) return url;
    // Cloudinary: public secure_url. Leave untouched.
    if (url.includes('res.cloudinary.com')) return url;
    // R2: extract key after the bucket segment and mint a presigned GET URL.
    if (url.includes('.r2.cloudflarestorage.com/')) {
      try {
        const u = new URL(url);
        // path looks like "/<bucket>/<key...>"
        const parts = u.pathname.replace(/^\/+/, '').split('/');
        const key = parts.slice(1).join('/'); // drop bucket segment
        if (!key) return url;
        return await this.storage.getSignedUrl(key, 3600);
      } catch (err) {
        logger.warn({ err, url }, 'admin.service: failed to sign R2 URL, returning original');
        return url;
      }
    }
    // Custom CDN over R2: extract path after the CDN host.
    try {
      const u = new URL(url);
      const key = u.pathname.replace(/^\/+/, '');
      if (!key) return url;
      return await this.storage.getSignedUrl(key, 3600);
    } catch {
      return url;
    }
  }

  async dashboard(): Promise<AdminDashboard> {
    return this.repo.dashboard();
  }

  async listApplications(status?: ApplicationStatus): Promise<ApplicationAdminView[]> {
    const apps = (await this.applications.listForAdmin(
      status ? { status } : undefined,
    )) as ApplicationAdminView[];
    return Promise.all(
      apps.map(async (a) => ({
        ...a,
        proofOfWorkUrl: await this.withSignedUrl(a.proofOfWorkUrl),
        idDocumentUrl: (await this.withSignedUrl(a.idDocumentUrl)) ?? a.idDocumentUrl,
        selfieUrl: (await this.withSignedUrl(a.selfieUrl)) ?? a.selfieUrl,
        degreeCertificateUrl: await this.withSignedUrl(a.degreeCertificateUrl),
      })),
    );
  }

  async reviewApplication(
    id: string,
    input: ReviewApplicationInput,
    admin: AuthedUser,
  ): Promise<ApplicationAdminView> {
    const updated = (await this.applications.review(
      id,
      { status: input.status, adminNotes: input.adminNotes },
      admin,
    )) as ApplicationAdminView;

    // On approval, promote the applicant to an active member so they can log in.
    if (input.status === ApplicationStatus.Approved) {
      const app = await this.applications.getById(id);
      const userId = app?.userId;
      if (userId) {
        await this.repo.setStatus(userId, UserStatus.Active);
        await this.repo.setRole(userId, UserRole.Member);
        await this.repo.setVerification(userId, { emailVerified: true });
      }
    }

    await this.repo.audit({
      adminId: admin.userId,
      action: `application.${input.status}`,
      entity: 'application',
      entityId: id,
      scope: AdminScope.Vetting,
      metadata: { adminNotes: input.adminNotes ?? null },
      ipAddress: null,
    });

    return {
      ...updated,
      proofOfWorkUrl: await this.withSignedUrl(updated.proofOfWorkUrl),
      idDocumentUrl: (await this.withSignedUrl(updated.idDocumentUrl)) ?? updated.idDocumentUrl,
      selfieUrl: (await this.withSignedUrl(updated.selfieUrl)) ?? updated.selfieUrl,
      degreeCertificateUrl: await this.withSignedUrl(updated.degreeCertificateUrl),
    };
  }

  async listMembers(filter: ListMembersFilter) {
    const [items, total] = await Promise.all([
      this.repo.listMembers(filter),
      this.repo.countMembers(filter),
    ]);
    return { items, total };
  }

  async getMember(userId: string): Promise<MemberDetail> {
    const member = await this.repo.getMemberDetail(userId);
    if (!member) throw new NotFoundError('Member not found', { userId });
    return member;
  }

  async suspendMember(
    userId: string,
    admin: AuthedUser,
    input: ModerateMemberInput,
  ): Promise<void> {
    const member = await this.guardNotSelf(userId, admin);
    if (member.status === UserStatus.Suspended) return;
    await this.repo.setStatus(userId, UserStatus.Suspended);
    await this.audit(admin, 'member.suspend', 'user', userId, AdminScope.Support, {
      reason: input.reason ?? null,
    });
  }

  async unsuspendMember(userId: string, admin: AuthedUser): Promise<void> {
    await this.guardNotSelf(userId, admin);
    await this.repo.setStatus(userId, UserStatus.Active);
    await this.audit(admin, 'member.unsuspend', 'user', userId, AdminScope.Support, {});
  }

  async banMember(userId: string, admin: AuthedUser, input: ModerateMemberInput): Promise<void> {
    const member = await this.guardNotSelf(userId, admin);
    if (member.status === UserStatus.Banned) return;
    await this.repo.setStatus(userId, UserStatus.Banned);
    await this.audit(admin, 'member.ban', 'user', userId, AdminScope.Support, {
      reason: input.reason ?? null,
    });
  }

  async unbanMember(userId: string, admin: AuthedUser): Promise<void> {
    await this.guardNotSelf(userId, admin);
    await this.repo.setStatus(userId, UserStatus.Active);
    await this.audit(admin, 'member.unban', 'user', userId, AdminScope.Support, {});
  }

  async verifyMember(
    userId: string,
    fields: { emailVerified?: boolean; phoneVerified?: boolean },
    admin: AuthedUser,
  ): Promise<void> {
    await this.repo.setVerification(userId, fields);
    await this.audit(admin, 'member.verify', 'user', userId, AdminScope.Support, { fields });
  }

  async listAdmins(): Promise<MemberView[]> {
    return this.repo.listAdmins();
  }

  async assignRole(userId: string, assignment: RoleAssignment, admin: AuthedUser): Promise<void> {
    const target = await this.repo.getMemberDetail(userId);
    if (!target) throw new NotFoundError('User not found', { userId });

    // Only a SuperAdmin may grant/revoke the SuperAdmin role.
    if (assignment.role === UserRole.SuperAdmin && admin.role !== UserRole.SuperAdmin) {
      throw new ConflictError('Only a SuperAdmin may assign the SuperAdmin role');
    }
    // A non-super admin cannot alter another admin's role.
    if (target.role === UserRole.SuperAdmin && admin.role !== UserRole.SuperAdmin) {
      throw new ConflictError('Only a SuperAdmin may modify a SuperAdmin');
    }

    await this.repo.setRole(userId, assignment.role);
    await this.audit(admin, 'role.assign', 'user', userId, AdminScope.Super, {
      role: assignment.role,
    });
    logger.info({ by: admin.userId, target: userId, role: assignment.role }, 'Admin role assigned');
  }

  roleMatrix(): RoleDescriptor[] {
    return ROLE_MATRIX;
  }

  async listSubscriptions(status?: unknown): Promise<SubscriptionAdminView[]> {
    return this.billing.listForAdmin(status);
  }

  async cancelSubscription(
    userId: string,
    input: CancelSubscriptionInput,
    admin: AuthedUser,
  ): Promise<void> {
    await this.billing.cancelSubscription(userId, input.atPeriodEnd);
    await this.audit(admin, 'subscription.cancel', 'subscription', userId, AdminScope.Billing, {
      atPeriodEnd: input.atPeriodEnd,
      reason: input.reason ?? null,
    });
  }

  async grantSubscription(
    userId: string,
    input: GrantSubscriptionInput,
    admin: AuthedUser,
  ): Promise<void> {
    await this.billing.grantSubscription(userId, input.plan, input.months);
    await this.audit(admin, 'subscription.grant', 'subscription', userId, AdminScope.Billing, {
      plan: input.plan,
      months: input.months,
      reason: input.reason ?? null,
    });
  }

  async listEvents(): Promise<unknown[]> {
    return this.events.listForAdmin();
  }

  async moderateEvent(
    id: string,
    input: EventModerationInput,
    admin: AuthedUser,
  ): Promise<unknown> {
    const data: Record<string, unknown> = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.featured !== undefined) data.featured = input.featured;
    const result = await this.events.update(id, data);
    await this.audit(admin, 'event.moderate', 'event', id, AdminScope.Events, { ...input });
    return result;
  }

  async broadcast(input: BroadcastInput, admin: AuthedUser): Promise<{ queued: number }> {
    const result = await this.notifications.bulk({
      type: input.type,
      title: input.title,
      body: input.body,
      channel: asEnum(input.channel),
      role: input.role,
      link: input.link,
      data: input.data,
    });
    await this.audit(admin, 'notification.broadcast', 'notification', null, AdminScope.Content, {
      type: input.type,
      channel: input.channel,
      role: input.role,
    });
    return result;
  }

  async listAudit(limit = 100): Promise<AdminAuditView[]> {
    return this.repo.listAudit(limit);
  }

  async search(q: string): Promise<GlobalSearchResult> {
    return this.repo.search(q);
  }

  /** Prevents an admin from acting on their own account for destructive ops. */
  private async guardNotSelf(userId: string, admin: AuthedUser): Promise<MemberDetail> {
    if (userId === admin.userId) {
      throw new ConflictError('You cannot perform this action on your own account');
    }
    const member = await this.repo.getMemberDetail(userId);
    if (!member) throw new NotFoundError('Member not found', { userId });
    return member;
  }

  private async audit(
    admin: AuthedUser,
    action: string,
    entity: string,
    entityId: string | null,
    scope: AdminScope,
    metadata: unknown,
  ): Promise<void> {
    await this.repo.audit({
      adminId: admin.userId,
      action,
      entity,
      entityId,
      scope,
      metadata,
      ipAddress: null,
    });
  }
}
