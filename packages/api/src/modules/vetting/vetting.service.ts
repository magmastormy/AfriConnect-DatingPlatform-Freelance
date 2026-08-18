import { prisma } from '@config/prisma';
import crypto from 'crypto';
import {
  NotFoundError,
  logger,
  NotificationChannel,
  ApplicationStatus,
  UserRole,
  UserStatus,
} from '@africonnect/shared';
import { INotificationService } from '@modules/notification/notification.service';
import { startSmileSession, verifySmileWebhook } from './vetting.smile';
import type { VettingMode, VettingSessionStatus } from './vetting.types';

export interface IVettingService {
  createSession(
    userId: string,
  ): Promise<{ sessionId: string; mode: VettingMode; hostedUrl: string }>;
  getStatus(
    userId: string,
  ): Promise<{ status: VettingSessionStatus | 'none'; mode: VettingMode | null; verified: boolean }>;
  completeSandbox(sessionId: string): Promise<void>;
  handleWebhook(rawBody: Buffer, signature: string, timestamp: string): Promise<void>;
}

export class VettingService implements IVettingService {
  constructor(private readonly notifications: INotificationService) {}

  async createSession(userId: string) {
    const sessionId = `vt_${crypto.randomBytes(12).toString('hex')}`;
    const started = await startSmileSession({ userId, sessionId });
    await prisma.vettingSession.create({
      data: {
        id: sessionId,
        userId,
        provider: 'smile',
        mode: started.mode,
        // Live: store the provider token so the async callback maps back to this session.
        externalRef: started.webToken ?? null,
        status: 'pending',
      },
    });
    return { sessionId: started.sessionId, mode: started.mode, hostedUrl: started.hostedUrl };
  }

  async getStatus(userId: string) {
    const session = await prisma.vettingSession.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    const verified = user?.role === UserRole.Member && user?.status === UserStatus.Active;
    return {
      status: (session?.status as VettingSessionStatus) ?? 'none',
      mode: (session?.mode as VettingMode) ?? null,
      verified,
    };
  }

  /**
   * Testing-only completion. The /vetting/sandbox simulator (opened by scanning
   * the QR on a phone) calls this with the unguessable session id — no auth
   * required, because the phone is not the signed-in device. Only sandbox
   * sessions can be completed this way.
   */
  async completeSandbox(sessionId: string): Promise<void> {
    const session = await prisma.vettingSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundError('Vetting session not found');
    if (session.mode !== 'sandbox') {
      throw new Error('Sandbox completion is only available in testing mode');
    }
    await this.approve(session.userId, session.id);
  }

  /** Live webhook entry point. Verifies the provider signature, then resolves. */
  async handleWebhook(rawBody: Buffer, signature: string, timestamp: string): Promise<void> {
    const decision = await verifySmileWebhook(rawBody, signature, timestamp);
    // Smile's callback carries the `user_id` we passed when starting the session
    // (not the opaque web token), so resolve the latest pending live session by user.
    const session = await prisma.vettingSession.findFirst({
      where: { userId: decision.userId, mode: 'live', status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      logger.warn({ userId: decision.userId }, 'No pending live vetting session for Smile webhook');
      return;
    }
    if (decision.approved) {
      await prisma.vettingSession.update({ where: { id: session.id }, data: { status: 'approved' } });
      await this.approve(session.userId, session.id);
    } else {
      await prisma.vettingSession.update({ where: { id: session.id }, data: { status: 'rejected' } });
    }
  }

  /** Flips the member to the Verified stage and notifies them. */
  private async approve(userId: string, sessionId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.Member, status: UserStatus.Active },
    });
    // Keep any open manual application consistent with the KYC decision.
    await prisma.application.updateMany({
      where: { userId, status: { in: [ApplicationStatus.Submitted, ApplicationStatus.UnderReview] } },
      data: { status: ApplicationStatus.Approved },
    });
    try {
      await this.notifications.create({
        userId,
        type: 'vetting.approved',
        title: 'You’re verified',
        body: 'Your ID verification passed. You can now connect with members and join events.',
        channel: NotificationChannel.InApp,
        link: '/portal',
      });
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to dispatch vetting.approved notification');
    }
    logger.info({ userId, sessionId }, 'Vetting approved — member flipped to Verified');
  }
}
