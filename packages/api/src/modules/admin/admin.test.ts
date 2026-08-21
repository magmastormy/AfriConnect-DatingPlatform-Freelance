import { SCOPE_ROLES, AdminScope, UserRole } from '@africonnect/shared';
import { AdminService, ROLE_MATRIX } from './admin.service';
import { IAdminRepository } from './admin.repository';
import { IApplicationService } from '@modules/application/application.service';
import { IEventService } from '@modules/event/event.service';
import { IBillingService } from '@modules/billing/billing.service';
import { INotificationService } from '@modules/notification/notification.service';
import { IMediaStorage } from '@africonnect/shared';
import { NotFoundError, ConflictError } from '@africonnect/shared';

function fakeRepo(over: Partial<IAdminRepository> = {}): IAdminRepository {
  return {
    dashboard: async () => ({
      applicationsPending: 0,
      applicationsUnderReview: 0,
      membersActive: 0,
      membersSuspended: 0,
      eventsPublished: 0,
      eventsDraft: 0,
      revenueZar: 0,
      mrrZar: 0,
      subscriptionsActive: 0,
    }),
    listMembers: async () => ({ items: [], total: 0 }) as never,
    countMembers: async () => 0,
    getMemberDetail: async () => null,
    setRole: async () => undefined,
    setStatus: async () => undefined,
    setVerification: async () => undefined,
    listAdmins: async () => [],
    audit: async () => undefined,
    listAudit: async () => [],
    ...over,
  } as unknown as IAdminRepository;
}

function fakeApplications(over: Partial<IApplicationService> = {}): IApplicationService {
  return {
    submit: async () => ({ id: 'a', status: 'submitted' as never }),
    getOwn: async () => ({}) as never,
    listForAdmin: async () => [],
    getById: async () => null,
    review: async () => ({}) as never,
    ...over,
  } as unknown as IApplicationService;
}

function fakeEvents(): IEventService {
  return {
    listUpcoming: async () => [],
    getById: async () => ({}),
    listForAdmin: async () => [],
    create: async () => ({}),
    update: async () => ({}),
    rsvp: async () => ({ status: 'confirmed' as never, waitlisted: false }),
    cancelRsvp: async () => undefined,
    listRsvps: async () => [],
    star: async () => undefined,
    myStars: async () => [],
  } as unknown as IEventService;
}

function fakeBilling(): IBillingService {
  return {
    createCheckout: async () => ({ url: '', mock: true }),
    getSubscription: async () => null,
    handleWebhook: async () => undefined,
    listForAdmin: async () => [],
    cancelSubscription: async () => undefined,
    grantSubscription: async () => undefined,
  } as unknown as IBillingService;
}

function fakeNotifications(): INotificationService {
  return {
    create: async () => ({}) as never,
    list: async () => [],
    markRead: async () => undefined,
    bulk: async () => ({ queued: 0 }),
  } as unknown as INotificationService;
}

// Pass-through storage for unit tests — admin.service will call getSignedUrl on
// the URLs returned by the application service, but tests aren't exercising the
// signing path; they assert behavior around the role/promotion logic. Returning
// the input unchanged keeps test fixtures realistic without needing real R2.
function fakeStorage(): IMediaStorage {
  return {
    name: 'fake',
    upload: async () => ({ url: '', publicId: '' }),
    remove: async () => undefined,
    getSignedUrl: async (id: string) => id,
  } as unknown as IMediaStorage;
}

const superAdmin = {
  userId: 'admin1',
  role: UserRole.SuperAdmin,
  email: 's@x',
  status: 'active' as never,
};
const vettingAdmin = {
  userId: 'admin2',
  role: UserRole.AdminVetting,
  email: 'v@x',
  status: 'active' as never,
};

describe('Admin scope/role matrix', () => {
  it('maps each scope to the correct owning roles', () => {
    expect(SCOPE_ROLES[AdminScope.Vetting]).toContain(UserRole.AdminVetting);
    expect(SCOPE_ROLES[AdminScope.Billing]).toContain(UserRole.AdminBilling);
    expect(SCOPE_ROLES[AdminScope.Super]).toEqual([UserRole.SuperAdmin]);
    // The generalist Admin owns every non-super scope.
    expect(SCOPE_ROLES[AdminScope.Events]).toContain(UserRole.Admin);
    expect(SCOPE_ROLES[AdminScope.Support]).toContain(UserRole.Admin);
  });

  it('exposes a role->scopes descriptor for each admin role', () => {
    const roles = ROLE_MATRIX.map((r) => r.role);
    expect(roles).toEqual(
      expect.arrayContaining([UserRole.SuperAdmin, UserRole.AdminVetting, UserRole.AdminBilling]),
    );
  });
});

describe('AdminService vetting', () => {
  it('promotes the applicant to an active member on approval and audits it', async () => {
    const audits: unknown[] = [];
    const repo = fakeRepo({
      getMemberDetail: async () => null,
      setRole: async () => undefined,
      setStatus: async () => undefined,
      setVerification: async () => undefined,
      audit: async (input) => {
        audits.push(input);
      },
    });
    const apps = fakeApplications({
      getById: async () => ({ id: 'app1', userId: 'user1', status: 'approved' as never }),
      review: async () => ({
        id: 'app1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b',
        city: 'johannesburg' as never,
        profession: 'x',
        status: 'approved' as never,
        createdAt: new Date(),
      }),
    });
    const service = new AdminService(repo, apps, fakeEvents(), fakeBilling(), fakeNotifications(), fakeStorage());

    const result = await service.reviewApplication(
      'app1',
      { status: 'approved' as never },
      superAdmin,
    );
    expect(result.status).toBe('approved');

    const last = audits[audits.length - 1] as { action: string; scope: AdminScope };
    expect(last.action).toBe('application.approved');
    expect(last.scope).toBe(AdminScope.Vetting);
  });

  it('rejects reviewing a non-existent application', async () => {
    const service = new AdminService(
      fakeRepo({ getMemberDetail: async () => null }),
      fakeApplications({
        getById: async () => null,
        review: async () => {
          throw new NotFoundError('nope');
        },
      }),
      fakeEvents(),
      fakeBilling(),
      fakeNotifications(),
      fakeStorage(),
    );
    await expect(
      service.reviewApplication('missing', { status: 'approved' as never }, superAdmin),
    ).rejects.toThrow();
  });
});

describe('AdminService role assignment (SuperAdmin only)', () => {
  it('allows a SuperAdmin to assign a split role', async () => {
    const repo = fakeRepo({
      getMemberDetail: async () => ({
        id: 'u',
        email: 'e',
        phone: 'p',
        role: UserRole.Member,
        status: 'active' as never,
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date(),
      }),
    });
    const service = new AdminService(
      repo,
      fakeApplications(),
      fakeEvents(),
      fakeBilling(),
      fakeNotifications(),
      fakeStorage(),
    );
    await expect(
      service.assignRole('u', { userId: 'u', role: UserRole.AdminVetting }, superAdmin),
    ).resolves.toBeUndefined();
  });

  it('blocks a non-super admin from assigning the SuperAdmin role', async () => {
    const repo = fakeRepo({
      getMemberDetail: async () => ({
        id: 'u',
        email: 'e',
        phone: 'p',
        role: UserRole.Member,
        status: 'active' as never,
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date(),
      }),
    });
    const service = new AdminService(
      repo,
      fakeApplications(),
      fakeEvents(),
      fakeBilling(),
      fakeNotifications(),
      fakeStorage(),
    );
    await expect(
      service.assignRole('u', { userId: 'u', role: UserRole.SuperAdmin }, vettingAdmin),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('prevents an admin acting on their own account (self-ban guard)', async () => {
    const repo = fakeRepo({
      getMemberDetail: async () => ({
        id: 'admin2',
        email: 'e',
        phone: 'p',
        role: UserRole.AdminVetting,
        status: 'active' as never,
        emailVerified: true,
        phoneVerified: true,
        createdAt: new Date(),
      }),
    });
    const service = new AdminService(
      repo,
      fakeApplications(),
      fakeEvents(),
      fakeBilling(),
      fakeNotifications(),
      fakeStorage(),
    );
    await expect(service.banMember('admin2', vettingAdmin, {})).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
