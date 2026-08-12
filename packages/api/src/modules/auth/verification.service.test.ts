import { VerificationService } from './verification.service';
import { IAuthRepository } from './auth.repository';
import { IEmailProvider, ISmsProvider } from '@africonnect/shared';
import { AuthenticationError } from '@africonnect/shared';

// ── Fakes ────────────────────────────────────────────────────────────────────
function fakeEmail(): IEmailProvider & { sent: unknown[] } {
  const sent: unknown[] = [];
  return {
    name: 'fake',
    async send(message) {
      sent.push(message);
      return { id: 'fake_1', delivered: true };
    },
    sent,
  };
}

function fakeSms(): ISmsProvider & { sent: unknown[] } {
  const sent: unknown[] = [];
  return {
    name: 'fake',
    async send(to, body) {
      sent.push({ to, body });
      return { id: 'fake_1', delivered: true };
    },
    sent,
  };
}

interface RepoState {
  byEmail: Record<string, { id: string; emailVerified: boolean; phoneVerified: boolean }>;
  tokens: Record<string, { userId: string; expiresAt: Date }>;
}

function fakeRepo(state: RepoState): IAuthRepository {
  return {
    findUserByEmail: async (email) => {
      const u = state.byEmail[email];
      return u ? ({ id: u.id, emailVerified: u.emailVerified, phoneVerified: u.phoneVerified } as never) : null;
    },
    findUserByPhone: async (phone) => {
      const u = Object.values(state.byEmail).find((x) => x.id === phone);
      return u ? ({ id: u.id, phoneVerified: u.phoneVerified } as never) : null;
    },
    createVerificationToken: async (userId, tokenHash, expiresAt) => {
      state.tokens[tokenHash] = { userId, expiresAt };
    },
    findVerificationToken: async (tokenHash) => {
      const t = state.tokens[tokenHash];
      if (!t) return null;
      if (t.expiresAt < new Date()) return null;
      return { userId: t.userId, expiresAt: t.expiresAt };
    },
    deleteVerificationToken: async (tokenHash) => {
      delete state.tokens[tokenHash];
    },
    setEmailVerified: async (userId, verified) => {
      const u = Object.values(state.byEmail).find((x) => x.id === userId);
      if (u) u.emailVerified = verified;
    },
    setPhoneVerified: async (userId, verified) => {
      const u = Object.values(state.byEmail).find((x) => x.id === userId);
      if (u) u.phoneVerified = verified;
    },
  } as unknown as IAuthRepository;
}

describe('VerificationService — email-primary, SMS-fallback', () => {
  it('emails a verification link on request and verifies the token', async () => {
    const state: RepoState = {
      byEmail: { 'a@b.co': { id: 'u1', emailVerified: false, phoneVerified: false } },
      tokens: {},
    };
    const email = fakeEmail();
    const svc = new VerificationService(fakeRepo(state), email, fakeSms());

    await svc.requestVerification('a@b.co');
    expect(email.sent).toHaveLength(1);
    const link = (email.sent[0] as { text: string }).text;
    const token = link.match(/token=([a-f0-9]+)/)![1];

    await svc.confirmEmail(token);
    expect(state.byEmail['a@b.co'].emailVerified).toBe(true);
  });

  it('does not reveal whether an unknown email exists (no-op)', async () => {
    const state: RepoState = { byEmail: {}, tokens: {} };
    const email = fakeEmail();
    const svc = new VerificationService(fakeRepo(state), email, fakeSms());
    const r = await svc.requestVerification('ghost@b.co');
    expect(r.delivered).toBe(true);
    expect(email.sent).toHaveLength(0);
  });

  it('rejects an invalid/expired email token', async () => {
    const state: RepoState = { byEmail: {}, tokens: {} };
    const svc = new VerificationService(fakeRepo(state), fakeEmail(), fakeSms());
    await expect(svc.confirmEmail('bogus')).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('sends an SMS OTP as the secondary fallback and verifies it', async () => {
    const state: RepoState = {
      byEmail: { 'p1': { id: 'p1', emailVerified: false, phoneVerified: false } },
      tokens: {},
    };
    // phone lookup returns the same id 'p1'
    const sms = fakeSms();
    const svc = new VerificationService(fakeRepo(state), fakeEmail(), sms);

    await svc.requestSmsFallback('p1');
    expect(sms.sent).toHaveLength(1);
    const code = (sms.sent[0] as { body: string }).body.match(/(\d{6})/)![1];

    await svc.confirmSmsFallback('p1', code);
    expect(state.byEmail['p1'].phoneVerified).toBe(true);
  });

  it('rejects a wrong SMS code', async () => {
    const state: RepoState = {
      byEmail: { 'p1': { id: 'p1', emailVerified: false, phoneVerified: false } },
      tokens: {},
    };
    const svc = new VerificationService(fakeRepo(state), fakeEmail(), fakeSms());
    await svc.requestSmsFallback('p1');
    await expect(svc.confirmSmsFallback('p1', '000000')).rejects.toBeInstanceOf(AuthenticationError);
  });
});
