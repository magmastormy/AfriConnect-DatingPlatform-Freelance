/**
 * Assigning `undefined` to a process.env key stores the STRING "undefined",
 * which is truthy and silently defeats every `!config.x` guard. Restoring env
 * state therefore has to delete absent keys rather than assign undefined.
 */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe('config — Stripe test-mode enforcement & provider defaults', () => {
  const ORIG = process.env.STRIPE_SECRET_KEY;
  const ORIG_EMAIL = process.env.EMAIL_PROVIDER;
  const ORIG_MEDIA = process.env.MEDIA_PROVIDER;
  const ORIG_SMS = process.env.SMS_PROVIDER;

  afterEach(() => {
    restoreEnv('STRIPE_SECRET_KEY', ORIG);
    restoreEnv('EMAIL_PROVIDER', ORIG_EMAIL);
    restoreEnv('MEDIA_PROVIDER', ORIG_MEDIA);
    restoreEnv('SMS_PROVIDER', ORIG_SMS);
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
    const {
      createEmailProvider,
      createMediaStorage,
      createSmsProvider,
    } = require('@config/providers');
    expect(createEmailProvider().name).toBe('console');
    expect(createMediaStorage().name).toBe('local');
    expect(createSmsProvider().name).toBe('console');
  });
});

describe('config — R2 provider validation', () => {
  const ORIG_MEDIA = process.env.MEDIA_PROVIDER;
  const ORIG_STRIPE = process.env.STRIPE_SECRET_KEY;
  const ORIG_R2_KEYS = {
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  };

  const setTestEnv = () => {
    process.env.MEDIA_PROVIDER = 'r2';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123'; // Required for config to load
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_BUCKET_NAME = 'test-bucket';
  };

  const clearR2Env = () => {
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_BUCKET_NAME;
  };

  afterEach(() => {
    restoreEnv('MEDIA_PROVIDER', ORIG_MEDIA);
    restoreEnv('STRIPE_SECRET_KEY', ORIG_STRIPE);
    for (const [key, value] of Object.entries(ORIG_R2_KEYS)) {
      restoreEnv(key, value);
    }
    jest.resetModules();
  });

  it('boots with R2 when all required variables are set', () => {
    setTestEnv();
    expect(() => require('@config/index')).not.toThrow();
  });

  it('throws descriptive error when R2_ACCESS_KEY_ID is missing', () => {
    setTestEnv();
    delete process.env.R2_ACCESS_KEY_ID;
    expect(() => require('@config/index')).toThrow(/R2_ACCESS_KEY_ID/i);
  });

  it('throws descriptive error when R2_SECRET_ACCESS_KEY is missing', () => {
    setTestEnv();
    delete process.env.R2_SECRET_ACCESS_KEY;
    expect(() => require('@config/index')).toThrow(/R2_SECRET_ACCESS_KEY/i);
  });

  it('throws descriptive error when R2_ACCOUNT_ID is missing', () => {
    setTestEnv();
    delete process.env.R2_ACCOUNT_ID;
    expect(() => require('@config/index')).toThrow(/R2_ACCOUNT_ID/i);
  });

  it('throws descriptive error when R2_BUCKET_NAME is missing', () => {
    setTestEnv();
    delete process.env.R2_BUCKET_NAME;
    expect(() => require('@config/index')).toThrow(/R2_BUCKET_NAME/i);
  });

  it('includes all missing variables in error message', () => {
    process.env.MEDIA_PROVIDER = 'r2';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123'; // Required for config to load
    // All variables missing
    clearR2Env();
    expect(() => require('@config/index')).toThrow(
      /R2_ACCESS_KEY_ID.*R2_SECRET_ACCESS_KEY.*R2_ACCOUNT_ID.*R2_BUCKET_NAME/i,
    );
  });

  it('does not validate R2 config when MEDIA_PROVIDER is not r2', () => {
    process.env.MEDIA_PROVIDER = 'local';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123'; // Required for config to load
    clearR2Env();
    expect(() => require('@config/index')).not.toThrow();
  });
});

// Property-based tests for R2 configuration validation
// Property 6: Configuration validation fails fast
// For any configuration where MEDIA_PROVIDER=r2 but missing required environment variables,
// the application shall fail to start with a descriptive error listing all missing variables
describe('config — Property 6: R2 configuration validation (property-based)', () => {
  const ORIG_MEDIA = process.env.MEDIA_PROVIDER;
  const ORIG_STRIPE = process.env.STRIPE_SECRET_KEY;
  const ORIG_R2_KEYS = {
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  };

  const R2_VARS = [
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_ACCOUNT_ID',
    'R2_BUCKET_NAME',
  ] as const;

  afterEach(() => {
    restoreEnv('MEDIA_PROVIDER', ORIG_MEDIA);
    restoreEnv('STRIPE_SECRET_KEY', ORIG_STRIPE);
    for (const [key, value] of Object.entries(ORIG_R2_KEYS)) {
      restoreEnv(key, value);
    }
    jest.resetModules();
  });

  /**
   * Loads config with MEDIA_PROVIDER=r2 and exactly `present` R2 vars set,
   * returning the thrown message. Fails the test if boot unexpectedly succeeds.
   */
  function bootWithR2Vars(present: readonly string[]): string {
    jest.resetModules();
    process.env.MEDIA_PROVIDER = 'r2';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
    for (const key of R2_VARS) {
      if (present.includes(key)) {
        process.env[key] = `test-${key.toLowerCase()}`;
      } else {
        delete process.env[key];
      }
    }
    try {
      require('@config/index');
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error(
      `Expected boot to fail with R2 vars present=[${present.join(', ')}] but it succeeded`,
    );
  }

  it('Property 6: the error names exactly the missing variables, for every subset', () => {
    // Enumerate all 15 proper subsets of the 4 required vars (all but the
    // complete set, which is the only combination allowed to boot). For each,
    // the error must name every absent var and no present one.
    for (let mask = 0; mask < (1 << R2_VARS.length) - 1; mask++) {
      const present = R2_VARS.filter((_, i) => (mask & (1 << i)) !== 0);
      const missing = R2_VARS.filter((v) => !present.includes(v));

      const message = bootWithR2Vars(present);

      expect(missing.length).toBeGreaterThan(0);
      for (const varName of missing) {
        expect(message).toContain(varName);
      }
      for (const varName of present) {
        expect(message).not.toContain(varName);
      }
    }
  });

  it('Property 6: boots cleanly once every required variable is present', () => {
    jest.resetModules();
    process.env.MEDIA_PROVIDER = 'r2';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
    for (const key of R2_VARS) {
      process.env[key] = `test-${key.toLowerCase()}`;
    }
    expect(() => require('@config/index')).not.toThrow();
  });
});
