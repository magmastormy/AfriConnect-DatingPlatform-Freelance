import { PrismaClient, User } from '@prisma/client';
import { InternalError } from '@africonnect/shared';
import { logger } from '@africonnect/shared';

export interface IAuthRepository {
  findOrCreateUser(email: string, phone: string): Promise<User>;
  findUserById(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserByPhone(phone: string): Promise<User | null>;
  findUserByClerkId(clerkId: string): Promise<User | null>;
  attachClerkId(userId: string, clerkId: string): Promise<void>;
  createUserFromClerk(clerkId: string, email: string): Promise<User>;
  storeRefreshToken(
    userId: string,
    tokenHash: string,
    jti: string,
    deviceId: string | null,
    ipAddress: string | null,
    expiresAt: Date,
  ): Promise<void>;
  findSessionByTokenHash(
    tokenHash: string,
  ): Promise<{ userId: string; jti: string; deviceId: string | null } | null>;
  findSessionByJti(jti: string): Promise<{ userId: string; tokenHash: string } | null>;
  revokeSession(tokenHash: string): Promise<void>;
  revokeSessionByJti(jti: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
  // ── Email verification (PRIMARY channel) ──
  setEmailVerified(userId: string, verified: boolean): Promise<void>;
  createVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findVerificationToken(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | null>;
  deleteVerificationToken(tokenHash: string): Promise<void>;
  // ── Phone verification (SECONDARY SMS fallback) ──
  setPhoneVerified(userId: string, verified: boolean): Promise<void>;
}

export class AuthRepository implements IAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOrCreateUser(email: string, phone: string): Promise<User> {
    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) return existing;
      return await this.prisma.user.create({ data: { email, phone } });
    } catch (error) {
      logger.error({ error, email }, 'AuthRepository: findOrCreateUser failed');
      throw new InternalError('Could not create/lookup user', { email });
    }
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findUserByClerkId(clerkId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { clerkId } });
  }

  async attachClerkId(userId: string, clerkId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { clerkId } });
  }

  async createUserFromClerk(clerkId: string, email: string): Promise<User> {
    // Provision a Clerk-sourced account but mark it pending so the member must
    // complete their profile (real phone, etc.) before they can match or chat.
    // A placeholder phone would otherwise break matching/OTP verification.
    return this.prisma.user.create({
      data: {
        email: email || `${clerkId}@clerk.local`,
        phone: `pending_${clerkId.slice(0, 16)}`,
        clerkId,
        emailVerified: true,
        status: 'pending',
      },
    });
  }

  async storeRefreshToken(
    userId: string,
    tokenHash: string,
    jti: string,
    deviceId: string | null,
    ipAddress: string | null,
    expiresAt: Date,
  ): Promise<void> {
    try {
      await this.prisma.session.create({
        data: { userId, tokenHash, jti, deviceId, ipAddress, expiresAt },
      });
    } catch (error) {
      logger.error({ error, userId }, 'AuthRepository: storeRefreshToken failed');
      throw new InternalError('Could not store session');
    }
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<{ userId: string; jti: string; deviceId: string | null } | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      select: { userId: true, jti: true, deviceId: true, expiresAt: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) return null;
    return { userId: session.userId, jti: session.jti, deviceId: session.deviceId };
  }

  async findSessionByJti(jti: string): Promise<{ userId: string; tokenHash: string } | null> {
    const session = await this.prisma.session.findUnique({
      where: { jti },
      select: { userId: true, tokenHash: true },
    });
    return session ? { userId: session.userId, tokenHash: session.tokenHash } : null;
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async revokeSessionByJti(jti: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { jti } });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }

  async setEmailVerified(userId: string, verified: boolean): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerified: verified } });
  }

  async createVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    try {
      await this.prisma.verificationToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    } catch (error) {
      logger.error({ error, userId }, 'AuthRepository: createVerificationToken failed');
      throw new InternalError('Could not create verification token');
    }
  }

  async findVerificationToken(
    tokenHash: string,
  ): Promise<{ userId: string; expiresAt: Date } | null> {
    const token = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
      select: { userId: true, expiresAt: true },
    });
    if (!token) return null;
    if (token.expiresAt < new Date()) return null;
    return { userId: token.userId, expiresAt: token.expiresAt };
  }

  async deleteVerificationToken(tokenHash: string): Promise<void> {
    await this.prisma.verificationToken.deleteMany({ where: { tokenHash } });
  }

  async setPhoneVerified(userId: string, verified: boolean): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { phoneVerified: verified } });
  }
}
