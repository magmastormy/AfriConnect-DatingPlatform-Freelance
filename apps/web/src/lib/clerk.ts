/**
 * Clerk configuration (client-safe).
 *
 * Clerk is the primary authentication provider for AfriConnect: it owns
 * sign-in, sign-up and sign-out. The browser authenticates with Clerk, then
 * the Clerk session JWT is exchanged for AfriConnect backend tokens via
 * POST /auth/clerk/exchange. Everything downstream of that exchange keeps
 * using our own AuthUser + access token, so the API contract is unchanged.
 *
 * Clerk is considered configured when a publishable key is present. The legacy
 * phone-OTP flow is retained as an explicit fallback for environments without
 * Clerk credentials (local development, CI, self-hosted previews) and is
 * selected by setting NEXT_PUBLIC_AUTH_MODE=otp.
 */

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

/** Explicit opt-out. Any value other than 'otp' leaves Clerk in charge. */
const forcedOtp = process.env.NEXT_PUBLIC_AUTH_MODE === 'otp';

/**
 * True when Clerk should drive authentication. Requires a publishable key —
 * mounting ClerkProvider without one throws at runtime, so we degrade to the
 * OTP flow rather than break the whole app.
 */
export const CLERK_ENABLED = !forcedOtp && publishableKey.length > 0;

export const CLERK_PUBLISHABLE_KEY = publishableKey;

/** Canonical auth routes. Kept here so links and Clerk props cannot drift. */
export const SIGN_IN_URL = '/sign-in';
export const SIGN_UP_URL = '/sign-up';
/** Where a member lands after authenticating. */
export const AFTER_SIGN_IN_URL = '/portal/discover';
/**
 * A brand-new account goes to onboarding, which creates the profile and then
 * offers vetting. Vetting is deliberately NOT part of sign-up.
 */
export const AFTER_SIGN_UP_URL = '/onboarding';

export interface ClerkExchangeResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}
