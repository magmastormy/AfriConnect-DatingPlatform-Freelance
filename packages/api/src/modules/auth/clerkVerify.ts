import crypto from 'crypto';
import { AuthenticationError, InternalError, logger } from '@africonnect/shared';

/**
 * Clerk session-token verification.
 *
 * Implemented directly against the JWKS endpoint rather than pulling in
 * @clerk/backend, so the API has no Clerk runtime dependency. Because this is
 * hand-rolled crypto verification it must be strict — every check below closes
 * a real bypass:
 *
 *   - alg pinned to RS256. Without this, a token could advertise a different
 *     algorithm and attempt confusion against the RSA verifier.
 *   - iss compared against the configured issuer. Signature validity alone only
 *     proves *some* Clerk instance signed it; without an issuer check a token
 *     minted by any other Clerk tenant (including an attacker's own free
 *     instance) would be accepted once its key was cached.
 *   - exp / nbf enforced with a small clock skew allowance.
 *   - typ/kty/use validated on the JWK so a non-signing key cannot be selected.
 *   - JWKS responses cached, with a single-flight guard and a forced refresh on
 *     unknown kid, so normal traffic does not hammer Clerk on every sign-in and
 *     key rotation still resolves.
 *
 * Raw tokens are never logged.
 */

/** Clock skew tolerated on exp/nbf comparisons. */
const CLOCK_SKEW_SECONDS = 60;
/** How long a successful JWKS fetch is reused. */
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
/** Minimum spacing between forced refreshes triggered by an unknown kid. */
const JWKS_REFRESH_COOLDOWN_MS = 30 * 1000;
const JWKS_FETCH_TIMEOUT_MS = 5000;

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

interface JwksCache {
  keys: Jwk[];
  fetchedAt: number;
}

let cache: JwksCache | null = null;
let inFlight: Promise<Jwk[]> | null = null;
let lastForcedRefresh = 0;

/**
 * Resolves the Clerk issuer for this deployment.
 *
 * CLERK_ISSUER is preferred. Failing that it is derived from the publishable
 * key, which encodes the frontend API host in base64 — this is exactly how
 * Clerk's own SDKs locate the instance, so a correct publishable key is enough
 * to configure verification.
 */
export function resolveClerkIssuer(): string {
  const explicit = process.env.CLERK_ISSUER?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const pk = (
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    ''
  ).trim();
  if (!pk) {
    throw new InternalError('Clerk is not configured: set CLERK_ISSUER or CLERK_PUBLISHABLE_KEY');
  }

  // pk_test_<base64(host$)> / pk_live_<base64(host$)>
  const encoded = pk.replace(/^pk_(test|live)_/, '');
  let host: string;
  try {
    host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$+$/, '');
  } catch {
    throw new InternalError('Malformed CLERK_PUBLISHABLE_KEY');
  }
  if (!host || !/^[a-z0-9.-]+$/i.test(host)) {
    throw new InternalError('Could not derive the Clerk issuer from CLERK_PUBLISHABLE_KEY');
  }
  return `https://${host}`;
}

function jwksUrl(): string {
  const explicit = process.env.CLERK_JWKS_URL?.trim();
  if (explicit) return explicit;
  return `${resolveClerkIssuer()}/.well-known/jwks.json`;
}

async function fetchJwks(): Promise<Jwk[]> {
  // Single-flight: concurrent sign-ins share one network call.
  if (inFlight) return inFlight;

  const url = jwksUrl();
  inFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), JWKS_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new InternalError('Could not fetch Clerk signing keys', { status: res.status });
      }
      const body = (await res.json()) as { keys?: Jwk[] };
      if (!Array.isArray(body.keys) || body.keys.length === 0) {
        throw new InternalError('Clerk JWKS response contained no keys');
      }
      cache = { keys: body.keys, fetchedAt: Date.now() };
      return body.keys;
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();

  return inFlight;
}

async function getSigningKey(kid: string): Promise<Jwk> {
  const fresh = cache && Date.now() - cache.fetchedAt < JWKS_CACHE_TTL_MS;
  let keys = fresh ? cache!.keys : await fetchJwks();

  let key = keys.find((k) => k.kid === kid);

  // Unknown kid on a cached set usually means Clerk rotated keys. Refresh once,
  // rate-limited so an invalid-kid flood cannot be used to hammer Clerk.
  if (!key && fresh && Date.now() - lastForcedRefresh > JWKS_REFRESH_COOLDOWN_MS) {
    lastForcedRefresh = Date.now();
    keys = await fetchJwks();
    key = keys.find((k) => k.kid === kid);
  }

  if (!key) throw new AuthenticationError('Unrecognised Clerk signing key');
  if (key.kty !== 'RSA') throw new AuthenticationError('Unsupported Clerk key type');
  if (key.use && key.use !== 'sig') throw new AuthenticationError('Clerk key is not a signing key');
  if (key.alg && key.alg !== 'RS256')
    throw new AuthenticationError('Unsupported Clerk key algorithm');
  if (!key.n || !key.e) throw new AuthenticationError('Incomplete Clerk signing key');
  return key;
}

export interface ClerkClaims {
  sub: string;
  email: string;
  sessionId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  imageUrl?: string;
}

/** Verifies a Clerk session JWT and returns its trusted claims. */
export async function verifyClerkToken(token: string): Promise<ClerkClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthenticationError('Malformed Clerk token');
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string; typ?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new AuthenticationError('Malformed Clerk token');
  }

  // Pin the algorithm before touching any key material.
  if (header.alg !== 'RS256') throw new AuthenticationError('Unexpected Clerk token algorithm');
  if (header.typ && header.typ !== 'JWT')
    throw new AuthenticationError('Unexpected Clerk token type');
  if (!header.kid) throw new AuthenticationError('Clerk token is missing a key id');

  const key = await getSigningKey(header.kid);

  const publicKey = crypto.createPublicKey({
    key: { kty: 'RSA', n: key.n, e: key.e } as crypto.JsonWebKeyInput['key'],
    format: 'jwk',
  });

  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    Buffer.from(signatureB64, 'base64url'),
  );
  if (!verified) throw new AuthenticationError('Invalid Clerk token signature');

  // Signature is valid; now the claims must match this deployment.
  const nowSeconds = Math.floor(Date.now() / 1000);

  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  if (exp === null || exp + CLOCK_SKEW_SECONDS < nowSeconds) {
    throw new AuthenticationError('Clerk token expired');
  }
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : null;
  if (nbf !== null && nbf - CLOCK_SKEW_SECONDS > nowSeconds) {
    throw new AuthenticationError('Clerk token is not yet valid');
  }

  const expectedIssuer = resolveClerkIssuer();
  const iss = typeof payload.iss === 'string' ? payload.iss.replace(/\/$/, '') : '';
  if (iss !== expectedIssuer) {
    // A valid signature from the wrong tenant is exactly the attack this stops.
    logger.warn({ iss }, 'Rejected Clerk token from an unexpected issuer');
    throw new AuthenticationError('Clerk token issuer mismatch');
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (!sub) throw new AuthenticationError('Clerk token is missing a subject');

  // Clerk only includes email when the session token template exposes it.
  const email =
    typeof payload.email === 'string'
      ? payload.email
      : typeof payload.primary_email_address === 'string'
        ? payload.primary_email_address
        : '';

  // Extract name fields from Clerk token if available
  const firstName =
    typeof payload.given_name === 'string'
      ? payload.given_name
      : typeof payload.first_name === 'string'
        ? payload.first_name
        : undefined;
  const lastName =
    typeof payload.family_name === 'string'
      ? payload.family_name
      : typeof payload.last_name === 'string'
        ? payload.last_name
        : undefined;
  const fullName = typeof payload.name === 'string' ? payload.name : undefined;
  const imageUrl =
    typeof payload.picture === 'string'
      ? payload.picture
      : typeof payload.image_url === 'string'
        ? payload.image_url
        : undefined;

  logger.debug(
    {
      sub,
      email,
      hasFirstName: !!firstName,
      hasLastName: !!lastName,
      hasFullName: !!fullName,
      hasImageUrl: !!imageUrl,
    },
    'Clerk token profile data extracted',
  );

  return {
    sub,
    email: email.toLowerCase(),
    sessionId: typeof payload.sid === 'string' ? payload.sid : undefined,
    firstName,
    lastName,
    fullName,
    imageUrl,
  };
}

/** Test seam: drops cached JWKS state. */
export function __resetClerkKeyCache(): void {
  cache = null;
  inFlight = null;
  lastForcedRefresh = 0;
}
