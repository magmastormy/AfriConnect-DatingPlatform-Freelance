import { createApplicationSchema } from './application.schema';
import { ApplicationService } from './application.service';
import { decryptPii } from '@africonnect/shared';

const fakeNotifications = () => ({
  create: jest.fn().mockResolvedValue({}),
  list: jest.fn().mockResolvedValue([]),
  markRead: jest.fn().mockResolvedValue(undefined),
  unreadCount: jest.fn().mockResolvedValue(0),
  markAllRead: jest.fn().mockResolvedValue(undefined),
  bulk: jest.fn().mockResolvedValue({ queued: 0 }),
  notifyAdmins: jest.fn().mockResolvedValue(0),
});

const base = {
  firstName: 'A',
  lastName: 'B',
  dateOfBirth: '1990-01-01',
  gender: 'male',
  nationality: 'ZA',
  profession: 'Dev',
  employer: 'X',
  educationLevel: 'bachelors',
  institution: 'U',
  city: 'cape_town',
  idDocumentUrl: 'https://x/id.png',
  selfieUrl: 'https://x/selfie.png',
};

describe('createApplicationSchema', () => {
  it('rejects when neither LinkedIn nor proof-of-work is provided', () => {
    const r = createApplicationSchema.safeParse(base);
    expect(r.success).toBe(false);
  });

  it('accepts LinkedIn without proof-of-work', () => {
    const r = createApplicationSchema.safeParse({
      ...base,
      linkedInUrl: 'https://linkedin.com/in/a',
    });
    expect(r.success).toBe(true);
  });

  it('accepts proof-of-work without LinkedIn', () => {
    const r = createApplicationSchema.safeParse({
      ...base,
      proofOfWorkUrl: 'https://x/proof.pdf',
    });
    expect(r.success).toBe(true);
  });
});

describe('ApplicationService.submit', () => {
  const payload = {
    ...base,
    linkedInUrl: 'https://linkedin.com/in/a',
  };

  it('derives email/phone from the linked account when omitted', async () => {
    const repo = {
      findByUserId: jest.fn().mockResolvedValue(null),
      getUserContact: jest.fn().mockResolvedValue({ email: 'a@b.com', phone: '+27123456789' }),
      create: jest.fn().mockResolvedValue({ id: 'app1', status: 'submitted' }),
    };
    const svc = new ApplicationService(repo as never, fakeNotifications());
    const res = await svc.submit(payload as never, {
      userId: 'u1',
      role: 'member' as never,
      email: 'a@b.com',
      status: 'active' as never,
    });
    expect(res.id).toBe('app1');
    const data = repo.create.mock.calls[0][0];
    // encryptPii uses a random IV, so compare via decrypt round-trip rather than
    // exact ciphertext equality.
    expect(data.email).not.toBe('a@b.com');
    expect(decryptPii(data.email)).toBe('a@b.com');
    expect(decryptPii(data.phone)).toBe('+27123456789');
  });

  it('does not allow a second open application', async () => {
    const repo = {
      findByUserId: jest.fn().mockResolvedValue({ status: 'under_review' }),
      getUserContact: jest.fn(),
      create: jest.fn(),
    };
    const svc = new ApplicationService(repo as never, fakeNotifications());
    await expect(
      svc.submit(payload as never, {
        userId: 'u1',
        role: 'member' as never,
        email: 'a@b.com',
        status: 'active' as never,
      }),
    ).rejects.toThrow(/already have an application/);
  });
});
