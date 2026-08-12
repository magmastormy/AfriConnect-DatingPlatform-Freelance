// Optional Clerk integration (gated by NEXT_PUBLIC_AUTH_MODE === 'clerk').
//
// When enabled, the user authenticates with Clerk in the browser; we then
// exchange the Clerk session JWT for an AfriConnect backend token via
// POST /auth/clerk/exchange. This keeps the existing OTP flow intact and lets
// the product use Clerk's hosted sign-in/up UI without forking the API.
//
// NOTE: enable by (1) installing @clerk/nextjs, (2) setting NEXT_PUBLIC_AUTH_MODE=clerk
// and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, and (3) adding the <ClerkProvider> mount in
// app/clerk-provider.tsx. Until then this module is inert and OTP remains the active path.

export const CLERK_ENABLED = process.env.NEXT_PUBLIC_AUTH_MODE === 'clerk';

export interface ClerkExchangeResult {
  accessToken: string;
  refreshToken: string;
  user: {
    userId: string;
    role: string;
    email: string;
    status: string;
  };
}
