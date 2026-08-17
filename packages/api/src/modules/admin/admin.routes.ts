import { Router } from 'express';
import { AdminController } from './admin.controller';
import { IAdminService } from './admin.service';
import { authorize } from '@config/middleware';
import { UserRole, AdminScope, SCOPE_ROLES } from '@africonnect/shared';

const VETTING = SCOPE_ROLES[AdminScope.Vetting];
const EVENTS = SCOPE_ROLES[AdminScope.Events];
const BILLING = SCOPE_ROLES[AdminScope.Billing];
const SUPPORT = SCOPE_ROLES[AdminScope.Support];
const CONTENT = SCOPE_ROLES[AdminScope.Content];
const SUPER = SCOPE_ROLES[AdminScope.Super];

export function adminRoutes(controller: AdminController, _service: IAdminService): Router {
  const router = Router();

  // Any administrator can view the operational dashboard.
  router.get(
    '/dashboard',
    authorize(
      UserRole.Admin,
      UserRole.AdminVetting,
      UserRole.AdminEvents,
      UserRole.AdminBilling,
      UserRole.AdminSupport,
      UserRole.AdminContent,
      UserRole.SuperAdmin,
    ),
    controller.dashboard,
  );

  // ── Vetting scope ───────────────────────────────────────────────────────────
  router.get('/applications', authorize(...VETTING), controller.listApplications);
  router.post('/applications/:id/review', authorize(...VETTING), controller.reviewApplication);

  // ── Support scope (members) ──────────────────────────────────────────────────
  router.get('/members', authorize(...SUPPORT), controller.listMembers);
  router.get('/members/:id', authorize(...SUPPORT), controller.getMember);
  router.post('/members/:id/suspend', authorize(...SUPPORT), controller.suspendMember);
  router.post('/members/:id/unsuspend', authorize(...SUPPORT), controller.unsuspendMember);
  router.post('/members/:id/ban', authorize(...SUPPORT), controller.banMember);
  router.post('/members/:id/unban', authorize(...SUPPORT), controller.unbanMember);
  router.post('/members/:id/verify', authorize(...SUPPORT), controller.verifyMember);

  // ── SuperAdmin scope (role management) ────────────────────────────────────────
  router.get('/admins', authorize(...SUPER), controller.listAdmins);
  router.get('/roles', authorize(...SUPER), controller.roleMatrix);
  router.post('/admins/:id/role', authorize(...SUPER), controller.assignRole);

  // ── Billing scope ────────────────────────────────────────────────────────────
  router.get('/subscriptions', authorize(...BILLING), controller.listSubscriptions);
  router.post('/subscriptions/:id/cancel', authorize(...BILLING), controller.cancelSubscription);
  router.post('/subscriptions/:id/grant', authorize(...BILLING), controller.grantSubscription);

  // ── Events scope ─────────────────────────────────────────────────────────────
  router.get('/events', authorize(...EVENTS), controller.listEvents);
  router.post('/events/:id/moderate', authorize(...EVENTS), controller.moderateEvent);

  // ── Content scope (notifications) ────────────────────────────────────────────
  router.post('/notifications/broadcast', authorize(...CONTENT), controller.broadcast);

  // ── Audit (any administrator can read) ──────────────────────────────────────
  router.get(
    '/audit',
    authorize(
      UserRole.Admin,
      UserRole.AdminVetting,
      UserRole.AdminEvents,
      UserRole.AdminBilling,
      UserRole.AdminSupport,
      UserRole.AdminContent,
      UserRole.SuperAdmin,
    ),
    controller.listAudit,
  );

  // ── Global search (any administrator) ─────────────────────────────────────
  router.get(
    '/search',
    authorize(
      UserRole.Admin,
      UserRole.AdminVetting,
      UserRole.AdminEvents,
      UserRole.AdminBilling,
      UserRole.AdminSupport,
      UserRole.AdminContent,
      UserRole.SuperAdmin,
    ),
    controller.search,
  );

  return router;
}
