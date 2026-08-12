/**
 * Named constants — magic numbers/thresholds are banned in code
 * (AGENTS.md Clause 2.8). Central source of truth.
 */

// ── Auth / Verification (Technical Stack §3 Module 1) ─────────────────────
// Verification is email-primary: an email link carrying a signed token is the
// default path. SMS OTP is a secondary fallback when the user cannot receive
// email. Both set the same verified bits on the account.
export const VERIFY_TOKEN_LENGTH = 32; // bytes -> hex token for email links
export const VERIFY_TOKEN_TTL_MINUTES = 30;
export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_REQUESTS_PER_WINDOW = 3; // per 15 min per phone
export const OTP_REQUEST_WINDOW_MINUTES = 15;
export const LOGIN_MAX_ATTEMPTS_PER_WINDOW = 5; // per 15 min per IP
// Fallback (SMS) OTP is rate-limited separately from login OTP.
export const SMS_FALLBACK_MAX_REQUESTS_PER_WINDOW = 3; // per 60 min per phone
export const SMS_FALLBACK_WINDOW_MINUTES = 60;

export const JWT_ACCESS_TTL_MINUTES = 15;
export const JWT_REFRESH_TTL_DAYS = 7;

// ── Matching (Technical Stack §3 Module 4) ─────────────────────────────────
export const DAILY_MATCH_LIMIT = 5;
export const MIN_COMPATIBILITY_THRESHOLD = 60;
export const MATCH_SCORE_EDUCATION = 30;
export const MATCH_SCORE_PROFESSION = 25;
export const MATCH_SCORE_AGE = 20;
export const MATCH_SCORE_CITY = 15;
export const MATCH_SCORE_GOALS = 10;
export const MATCH_SCORE_INTERESTS = 5;
export const MATCH_PENALTY_PASSED = 20;
export const MATCH_PENALTY_BLOCKED = 50;
export const MATCH_PENALTY_DEALBREAKER = 40;
export const MATCH_BONUS_VERIFIED = 10;

// ── Profile (Technical Stack §3 Module 3) ──────────────────────────────────
export const PROFILE_MIN_PHOTOS = 3;
export const PROFILE_MAX_PHOTOS = 5;
export const BIO_MAX_LENGTH = 500;

// ── Events (Technical Stack §3 Module 6) ───────────────────────────────────
export const EVENT_MAX_CAPACITY_MVP = 40;
export const EVENT_STAR_REVEAL_HOURS_BEFORE = 24;

// ── Rate limits (AGENTS.md Clause 3.4 / Stack §5.4) ───────────────────────
export const RATE_LIMIT_AUTH_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_AUTH_MAX = 5;
export const RATE_LIMIT_GENERAL_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_GENERAL_MAX = 100;
export const RATE_LIMIT_UPLOAD_WINDOW_MS = 60 * 60 * 1000;
export const RATE_LIMIT_UPLOAD_MAX = 3;

// ── Misc ───────────────────────────────────────────────────────────────────
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const CORS_ALLOWED_ORIGINS = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [
  'http://localhost:3000',
  'http://localhost:4000',
];
