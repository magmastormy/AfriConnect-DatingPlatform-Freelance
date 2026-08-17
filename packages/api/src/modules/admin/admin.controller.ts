import { Request, Response } from 'express';
import { IAdminService } from './admin.service';
import { asyncHandler, success, ValidationError } from '@africonnect/shared';
import {
  listQuerySchema,
  memberQuerySchema,
  reviewApplicationSchema,
  assignRoleSchema,
  memberActionSchema,
  subscriptionCancelSchema,
  grantSubscriptionSchema,
  eventModerationSchema,
  bulkNotifySchema,
  userIdParamSchema,
  eventIdParamSchema,
} from './admin.schema';

export class AdminController {
  constructor(private readonly service: IAdminService) {}

  dashboard = asyncHandler(async (_req: Request, res: Response) => {
    const data = await this.service.dashboard();
    res.status(200).json(success(data));
  });

  // ── Vetting ────────────────────────────────────────────────────────────────
  listApplications = asyncHandler(async (req: Request, res: Response) => {
    const status = listQuerySchema.partial().parse(req.query).status;
    const apps = await this.service.listApplications(status);
    res.status(200).json(success(apps));
  });

  reviewApplication = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    const body = reviewApplicationSchema.parse(req.body);
    const app = await this.service.reviewApplication(id, body, req.user!);
    res.status(200).json(success(app));
  });

  // ── Members / Support ────────────────────────────────────────────────────────
  listMembers = asyncHandler(async (req: Request, res: Response) => {
    const q = memberQuerySchema.parse(req.query);
    const { items, total } = await this.service.listMembers({
      status: q.status,
      role: q.role,
      search: q.search,
      page: q.page,
      limit: q.limit,
    });
    res.status(200).json(success({ items, total }, { page: q.page, limit: q.limit, total }));
  });

  getMember = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    const member = await this.service.getMember(id);
    res.status(200).json(success(member));
  });

  suspendMember = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    const body = memberActionSchema.parse(req.body);
    await this.service.suspendMember(id, req.user!, body);
    res.status(200).json(success({ id, status: 'suspended' }));
  });

  unsuspendMember = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    await this.service.unsuspendMember(id, req.user!);
    res.status(200).json(success({ id, status: 'active' }));
  });

  banMember = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    const body = memberActionSchema.parse(req.body);
    await this.service.banMember(id, req.user!, body);
    res.status(200).json(success({ id, status: 'banned' }));
  });

  unbanMember = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    await this.service.unbanMember(id, req.user!);
    res.status(200).json(success({ id, status: 'active' }));
  });

  verifyMember = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    const body = req.body ?? {};
    if (typeof body.emailVerified !== 'boolean' && typeof body.phoneVerified !== 'boolean') {
      throw new ValidationError('Provide emailVerified and/or phoneVerified as booleans');
    }
    await this.service.verifyMember(
      id,
      { emailVerified: body.emailVerified, phoneVerified: body.phoneVerified },
      req.user!,
    );
    res.status(200).json(success({ id, verified: true }));
  });

  // ── Admins / Roles (SuperAdmin) ──────────────────────────────────────────────
  listAdmins = asyncHandler(async (_req: Request, res: Response) => {
    const admins = await this.service.listAdmins();
    res.status(200).json(success(admins));
  });

  roleMatrix = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(success(this.service.roleMatrix()));
  });

  assignRole = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    const body = assignRoleSchema.parse(req.body);
    await this.service.assignRole(id, { userId: id, role: body.role }, req.user!);
    res.status(200).json(success({ id, role: body.role }));
  });

  // ── Billing ──────────────────────────────────────────────────────────────────
  listSubscriptions = asyncHandler(async (req: Request, res: Response) => {
    const status = listQuerySchema.partial().parse(req.query).status;
    const subs = await this.service.listSubscriptions(status);
    res.status(200).json(success(subs));
  });

  cancelSubscription = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    const body = subscriptionCancelSchema.parse(req.body);
    await this.service.cancelSubscription(id, body, req.user!);
    res.status(200).json(success({ id, cancelled: true, atPeriodEnd: body.atPeriodEnd }));
  });

  grantSubscription = asyncHandler(async (req: Request, res: Response) => {
    const { id } = userIdParamSchema.parse(req.params);
    const body = grantSubscriptionSchema.parse(req.body);
    await this.service.grantSubscription(id, body, req.user!);
    res.status(200).json(success({ id, granted: true, plan: body.plan }));
  });

  // ── Events ────────────────────────────────────────────────────────────────────
  listEvents = asyncHandler(async (_req: Request, res: Response) => {
    const events = await this.service.listEvents();
    res.status(200).json(success(events));
  });

  moderateEvent = asyncHandler(async (req: Request, res: Response) => {
    const { id } = eventIdParamSchema.parse(req.params);
    const body = eventModerationSchema.parse(req.body);
    const event = await this.service.moderateEvent(id, body, req.user!);
    res.status(200).json(success(event));
  });

  // ── Content / Notifications ──────────────────────────────────────────────────
  broadcast = asyncHandler(async (req: Request, res: Response) => {
    const body = bulkNotifySchema.parse(req.body);
    const result = await this.service.broadcast(body, req.user!);
    res.status(202).json(success(result));
  });

  // ── Audit ──────────────────────────────────────────────────────────────────
  listAudit = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await this.service.listAudit(limit);
    res.status(200).json(success(logs));
  });

  // ── Global search (members / applications / subscriptions) ──────────────────
  search = asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await this.service.search(q);
    res.status(200).json(success(result));
  });
}
