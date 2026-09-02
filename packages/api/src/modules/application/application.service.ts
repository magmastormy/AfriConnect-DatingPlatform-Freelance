import { IApplicationRepository } from './application.repository';
import {
  CreateApplicationInput,
  ReviewApplicationInput,
  ApplicationView,
} from './application.types';
import {
  AuthedUser,
  ApplicationStatus,
  NotFoundError,
  ConflictError,
  ValidationError,
  ProofOfWorkType,
  Gender,
  EducationLevel,
  City,
  asEnum,
  AdminScope,
  NotificationChannel,
  logger,
} from '@africonnect/shared';
import { encryptPii } from '@africonnect/shared';
import { INotificationService } from '@modules/notification/notification.service';
import { config } from '@config/index';
import { autoApproveVetting } from '@config/prototype';

export interface IApplicationService {
  submit(
    input: CreateApplicationInput,
    user: AuthedUser,
  ): Promise<{ id: string; status: ApplicationStatus }>;
  getOwn(userId: string): Promise<ApplicationView>;
  listForAdmin(filter?: { status?: ApplicationStatus }): Promise<ApplicationView[]>;
  getById(
    id: string,
  ): Promise<{ id: string; userId: string | null; status: ApplicationStatus } | null>;
  review(id: string, input: ReviewApplicationInput, admin: AuthedUser): Promise<ApplicationView>;
}

/** Statuses that still occupy the single active application slot. */
const OPEN_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.Submitted,
  ApplicationStatus.UnderReview,
  ApplicationStatus.Approved,
];

/**
 * Written when the applicant did not supply part of the professional dossier.
 * The prototype build only collects identity documents, and these columns are
 * NOT NULL — but fabricating a plausible employer would misrepresent what the
 * reviewer actually submitted, so we record the absence explicitly instead.
 */
const NOT_PROVIDED = 'Not provided';

export class ApplicationService implements IApplicationService {
  constructor(
    private readonly repo: IApplicationRepository,
    private readonly notifications: INotificationService,
  ) {}

  /**
   * Creates the caller's vetting application.
   *
   * One open application per account: resubmission is only allowed after a
   * rejection or an on-hold decision, so the review queue cannot be flooded
   * and reviewers never see two live records for one member.
   */
  async submit(
    input: CreateApplicationInput,
    user: AuthedUser,
  ): Promise<{ id: string; status: ApplicationStatus }> {
    const existing = await this.repo.findByUserId(user.userId);
    if (existing && OPEN_STATUSES.includes(asEnum<ApplicationStatus>(existing.status))) {
      throw new ConflictError('You already have an application in progress', {
        status: existing.status,
      });
    }

    // Email/phone are optional in the 2-step flow; fall back to the linked
    // account's contact details so vetting still has the PII it requires.
    const contact = await this.repo.getUserContact(user.userId);
    const email = input.email ?? contact.email;
    const phone = input.phone ?? contact.phone;
    if (!email || !phone) {
      throw new ValidationError('Unable to resolve account email/phone for this application');
    }

    // Professional dossier. These columns are NOT NULL but are optional on the
    // input (the prototype collects identity documents only), so anything the
    // applicant skipped is recorded as an explicit placeholder. In the real
    // product the schema demands every field, making this a no-op.
    const dossier = {
      nationality: input.nationality ?? NOT_PROVIDED,
      profession: input.profession ?? NOT_PROVIDED,
      employer: input.employer ?? NOT_PROVIDED,
      educationLevel: input.educationLevel ?? EducationLevel.Professional,
      institution: input.institution ?? NOT_PROVIDED,
      city: input.city ?? City.Johannesburg,
      // The trimmed prototype onboarding omits gender; the Application.gender
      // column is NOT NULL, so record a neutral placeholder rather than null.
      gender: input.gender ?? Gender.NonBinary,
    };

    // Encrypt PII columns at rest (AGENTS.md Clause 3.1).
    const created = await this.repo.create({
      ...input,
      ...dossier,
      userId: user.userId,
      email: encryptPii(email),
      phone: encryptPii(phone),
      status: ApplicationStatus.Submitted,
    });

    // ── Prototype shortcut ───────────────────────────────────────────────────
    // The reviewer still submits exactly the same documents and sees the whole
    // flow, but the approval lands immediately so nobody has to work the admin
    // queue in the demo. Returns early: no point creating a pending review task
    // for a decision that has already been made.
    if (config.prototypeMode) {
      await autoApproveVetting(user.userId);
      const approved = await this.repo.updateStatus(
        created.id,
        ApplicationStatus.Approved,
        'Auto-approved in prototype mode — no reviewer action required.',
        'prototype',
      );
      await this.notifyMember(user.userId, {
        type: 'vetting.approved',
        title: "You're verified",
        body: 'Your documents checked out — welcome in. You now have full access to matches and messaging.',
        link: '/portal/discover',
      });
      return { id: approved.id, status: asEnum<ApplicationStatus>(approved.status) };
    }

    // Surface the new submission to vetting admins as an in-app alert
    // (AGENTS.md: events needing admin intervention must notify).
    await this.notifyVetting(created.id, input, user);

    // Let the member know the application is with us, with a destination.
    await this.notifyMember(user.userId, {
      type: 'vetting.submitted',
      title: 'Application received',
      body: 'Thanks — our team is reviewing your verification. We’ll notify you here as soon as there’s a decision.',
      link: '/portal',
    });

    return { id: created.id, status: asEnum<ApplicationStatus>(created.status) };
  }

  /** Best-effort in-app message to a member; never fails the caller. */
  private async notifyMember(
    userId: string,
    n: { type: string; title: string; body: string; link?: string },
  ): Promise<void> {
    try {
      await this.notifications.create({
        userId,
        type: n.type,
        title: n.title,
        body: n.body,
        channel: NotificationChannel.InApp,
        link: n.link,
      });
    } catch (err) {
      logger.warn({ err, userId, type: n.type }, 'Failed to dispatch member notification');
    }
  }

  /** Dispatches a vetting alert without failing the submission if it errors. */
  private async notifyVetting(
    applicationId: string,
    input: CreateApplicationInput,
    user: AuthedUser,
  ): Promise<void> {
    try {
      await this.notifications.notifyAdmins(
        {
          userId: user.userId,
          type: 'vetting.pending',
          title: 'New vetting application',
          body: `${input.firstName} ${input.lastName} submitted an application for review`,
          channel: NotificationChannel.InApp,
          link: '/admin/applications',
          data: { applicationId, userId: user.userId },
        },
        [AdminScope.Vetting],
      );
    } catch (err) {
      logger.warn({ err, applicationId }, 'Failed to dispatch vetting notification');
    }
  }

  async getOwn(userId: string): Promise<ApplicationView> {
    const app = await this.repo.findByUserId(userId);
    if (!app) throw new NotFoundError('No application on file');
    return this.toView(app);
  }

  async listForAdmin(filter?: { status?: ApplicationStatus }): Promise<ApplicationView[]> {
    const apps = await this.repo.list(filter);
    return apps.map((a) => this.toView(a));
  }

  async getById(
    id: string,
  ): Promise<{ id: string; userId: string | null; status: ApplicationStatus } | null> {
    const app = await this.repo.findById(id);
    if (!app) return null;
    return { id: app.id, userId: app.userId, status: asEnum<ApplicationStatus>(app.status) };
  }

  async review(
    id: string,
    input: ReviewApplicationInput,
    admin: AuthedUser,
  ): Promise<ApplicationView> {
    const updated = await this.repo.updateStatus(id, input.status, input.adminNotes, admin.userId);
    const status = asEnum<ApplicationStatus>(updated.status);

    // Keep the member in the loop with a destination that matches their state.
    if (updated.userId) {
      if (status === ApplicationStatus.Approved) {
        await this.notifyMember(updated.userId, {
          type: 'vetting.approved',
          title: 'You’re verified',
          body: 'Your application was approved — welcome to AfriConnect. You can now connect with members and join events.',
          // Land members somewhere actionable, not on the dashboard.
          link: '/portal/discover',
        });
      } else if (status === ApplicationStatus.Rejected || status === ApplicationStatus.OnHold) {
        await this.notifyMember(updated.userId, {
          type: 'vetting.declined',
          title: 'Update on your application',
          body: 'Your application wasn’t approved this time. You can update your details and resubmit.',
          link: '/get-vetted',
        });
      }
    }

    return this.toView(updated);
  }

  private toView(a: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    nationality: unknown;
    gender: unknown;
    dateOfBirth: Date;
    city: unknown;
    profession: string;
    employer: string;
    educationLevel: unknown;
    institution: string;
    linkedInUrl?: string | null;
    proofOfWorkType?: string | null;
    proofOfWorkUrl?: string | null;
    idDocumentUrl: string;
    selfieUrl: string;
    degreeCertificateUrl?: string | null;
    status: unknown;
    createdAt: Date;
    reviewedBy?: string | null;
  }): ApplicationView {
    return {
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      nationality: (a.nationality as ApplicationView['nationality']) ?? '',
      gender: asEnum<ApplicationView['gender']>(a.gender),
      dateOfBirth: a.dateOfBirth,
      city: asEnum<ApplicationView['city']>(a.city),
      profession: a.profession,
      employer: a.employer,
      educationLevel: asEnum<ApplicationView['educationLevel']>(a.educationLevel),
      institution: a.institution,
      linkedInUrl: a.linkedInUrl ?? undefined,
      proofOfWorkType: (a.proofOfWorkType as ProofOfWorkType) ?? undefined,
      proofOfWorkUrl: a.proofOfWorkUrl ?? undefined,
      idDocumentUrl: a.idDocumentUrl,
      selfieUrl: a.selfieUrl,
      degreeCertificateUrl: a.degreeCertificateUrl ?? undefined,
      status: asEnum<ApplicationView['status']>(a.status),
      createdAt: a.createdAt,
      reviewedBy: a.reviewedBy ?? null,
    };
  }
}
