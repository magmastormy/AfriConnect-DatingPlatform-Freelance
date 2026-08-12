import { IApplicationRepository } from './application.repository';
import {
  CreateApplicationInput,
  ReviewApplicationInput,
  ApplicationView,
} from './application.types';
import { AuthedUser, ApplicationStatus, NotFoundError, asEnum } from '@africonnect/shared';
import { encryptPii } from '@africonnect/shared';

export interface IApplicationService {
  submit(
    input: CreateApplicationInput,
    user?: AuthedUser,
  ): Promise<{ id: string; status: ApplicationStatus }>;
  getOwn(userId: string): Promise<ApplicationView>;
  listForAdmin(filter?: { status?: ApplicationStatus }): Promise<ApplicationView[]>;
  getById(
    id: string,
  ): Promise<{ id: string; userId: string | null; status: ApplicationStatus } | null>;
  review(id: string, input: ReviewApplicationInput, admin: AuthedUser): Promise<ApplicationView>;
}

export class ApplicationService implements IApplicationService {
  constructor(private readonly repo: IApplicationRepository) {}

  async submit(
    input: CreateApplicationInput,
    user?: AuthedUser,
  ): Promise<{ id: string; status: ApplicationStatus }> {
    // Encrypt PII columns at rest (AGENTS.md Clause 3.1).
    const created = await this.repo.create({
      ...input,
      userId: user?.userId ?? null,
      email: encryptPii(input.email),
      phone: encryptPii(input.phone),
      status: ApplicationStatus.Submitted,
    });
    return { id: created.id, status: asEnum<ApplicationStatus>(created.status) };
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
    return this.toView(updated);
  }

  private toView(a: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    city: unknown;
    profession: string;
    status: unknown;
    createdAt: Date;
  }): ApplicationView {
    return {
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      city: asEnum<ApplicationView['city']>(a.city),
      profession: a.profession,
      status: asEnum<ApplicationView['status']>(a.status),
      createdAt: a.createdAt,
    };
  }
}
