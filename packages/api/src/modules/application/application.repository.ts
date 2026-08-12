import { PrismaClient, Application, ApplicationStatus } from '@prisma/client';
import { NotFoundError, ConflictError, InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';

export interface IApplicationRepository {
  create(data: Record<string, unknown>): Promise<Application>;
  findById(id: string): Promise<Application | null>;
  findByUserId(userId: string): Promise<Application | null>;
  list(filter?: { status?: ApplicationStatus }): Promise<Application[]>;
  updateStatus(
    id: string,
    status: ApplicationStatus,
    adminNotes: string | undefined,
    reviewedBy: string | undefined,
  ): Promise<Application>;
}

export class ApplicationRepository implements IApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Record<string, unknown>): Promise<Application> {
    try {
      return await this.prisma.application.create({ data: data as Application });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictError('An application with this email already exists');
      }
      logger.error({ error }, 'ApplicationRepository: create failed');
      throw new InternalError('Could not create application');
    }
  }

  async findById(id: string): Promise<Application | null> {
    return this.prisma.application.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Application | null> {
    return this.prisma.application.findFirst({ where: { userId } });
  }

  async list(filter?: { status?: ApplicationStatus }): Promise<Application[]> {
    return this.prisma.application.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    adminNotes: string | undefined,
    reviewedBy: string | undefined,
  ): Promise<Application> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError('Application not found', { id });
    try {
      return await this.prisma.application.update({
        where: { id },
        data: { status, adminNotes, reviewedBy, reviewedAt: new Date() },
      });
    } catch (error) {
      logger.error({ error, id }, 'ApplicationRepository: updateStatus failed');
      throw new InternalError('Could not update application');
    }
  }
}
