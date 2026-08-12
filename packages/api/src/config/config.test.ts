describe('config — Stripe test-mode enforcement & provider defaults', () => {
  const ORIG = process.env.STRIPE_SECRET_KEY;
  const ORIG_EMAIL = process.env.EMAIL_PROVIDER;
  const ORIG_MEDIA = process.env.MEDIA_PROVIDER;
  const ORIG_SMS = process.env.SMS_PROVIDER;

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = ORIG;
    process.env.EMAIL_PROVIDER = ORIG_EMAIL;
    process.env.MEDIA_PROVIDER = ORIG_MEDIA;
    process.env.SMS_PROVIDER = ORIG_SMS;
    jest.resetModules();
  });

  it('refuses to boot with a LIVE Stripe key (sk_live_)', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_abc123';
    process.env.MEDIA_PROVIDER = 'local';
    expect(() => require('@config/index')).toThrow(/test key|sk_test_/i);
  });

  it('boots with a TEST Stripe key (sk_test_)', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
    process.env.MEDIA_PROVIDER = 'local';
    expect(() => require('@config/index')).not.toThrow();
  });

  it('defaults providers to dev fallbacks (console email, local media, console sms)', () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.MEDIA_PROVIDER;
    delete process.env.SMS_PROVIDER;
    process.env.STRIPE_SECRET_KEY = ''; // unset so the guard doesn’t fire
    const { createEmailProvider, createMediaStorage, createSmsProvider } = require('@config/providers');
    expect(createEmailProvider().name).toBe('console');
    expect(createMediaStorage().name).toBe('local');
    expect(createSmsProvider().name).toBe('console');
  });
});
