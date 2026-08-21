import { PrismaClient } from '@prisma/client';
import { InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';

export interface IAdminAuthRepository {
  findAdminByEmail(email: string): Promise<{ id: string; email: string; role: string; status: string; passwordHash: string | null } | null>;
  countAdmins(): Promise<number>;
  createAdmin(email: string, passwordHash: string, role?: string): Promise<{ id: string; email: string; role: string; status: string }>;
  findUserById(id: string): Promise<{ id: string; email: string; role: string; status: string } | null>;
  findSessionByJti(jti: string): Promise<{ userId: string; tokenHash: string; deviceId: string | null } | null>;
  findSessionByTokenHash(hash: string): Promise<{ userId: string; deviceId: string | null } | null>;
  storeRefreshToken(userId: string, tokenHash: string, jti: string, deviceId: string | null, ip: string | null, expiresAt: Date): Promise<void>;
  revokeSession(tokenHash: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
}

export class AdminAuthRepository implements IAdminAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAdminByEmail(email: string) {
    // Use raw query to include passwordHash even if Prisma client is stale (no generate)
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; email: string; role: string; status: string; passwordHash: string | null }>>(
        `SELECT id, email, role, status, "passwordHash" FROM auth_users WHERE email=$1 LIMIT 1`,
        email,
      );
      return rows[0] ?? null;
    } catch (e) {
      logger.error({ err: e }, 'AdminAuthRepository: findAdminByEmail failed');
      throw new InternalError('Database lookup failed');
    }
  }

  async countAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: { role: { in: ['admin', 'admin_vetting', 'admin_events', 'admin_billing', 'admin_support', 'admin_content', 'superadmin'] } },
    });
  }

  async createAdmin(email: string, passwordHash: string, role = 'superadmin') {
    const phone = `+270000000${Math.floor(Math.random() * 900000) + 100000}`;
    try {
      // Raw SQL to avoid needing regenerated Prisma client for passwordHash
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; email: string; role: string; status: string }>>(
        `INSERT INTO auth_users (id, email, phone, role, status, "emailVerified", "phoneVerified", "passwordHash", "createdAt", "updatedAt", "tenantId")
         VALUES (gen_random_uuid(), $1, $2, $3::"UserRole", 'active'::"UserStatus", true, true, $4, NOW(), NOW(), 'tnt_bootstrap')
         RETURNING id, email, role::text as role, status::text as status`,
        email,
        phone,
        role,
        passwordHash,
      );
      return rows[0];
    } catch (e) {
      logger.error({ err: e }, 'AdminAuthRepository: createAdmin failed');
      throw new InternalError('Could not create admin');
    }
  }

  async findUserById(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) return null;
    return { id: u.id, email: u.email, role: u.role as string, status: u.status as string };
  }

  async findSessionByJti(jti: string) {
    const s = await this.prisma.session.findUnique({ where: { jti } });
    if (!s) return null;
    return { userId: s.userId, tokenHash: s.tokenHash, deviceId: s.deviceId };
  }

  async findSessionByTokenHash(hash: string) {
    const s = await this.prisma.session.findUnique({ where: { tokenHash: hash } });
    if (!s) return null;
    return { userId: s.userId, deviceId: s.deviceId };
  }

  async storeRefreshToken(userId: string, tokenHash: string, jti: string, deviceId: string | null, ip: string | null, expiresAt: Date): Promise<void> {
    await this.prisma.session.create({
      data: { userId, tokenHash, jti, deviceId, ipAddress: ip, expiresAt },
    });
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
