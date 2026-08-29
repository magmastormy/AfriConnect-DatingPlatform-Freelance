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
export const MIN_COMPATIBILITY_THRESHOLD = 20;
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

// ── MatchingEngine algorithm knobs (modules/match matching/algorithms) ─────
// These drive the hybrid recommender (MatchingEngine) that blends content-based
// filtering, collaborative filtering, diversity (MMR) re-ranking, business
// rules and fairness constraints. All are operator-tunable-style constants so
// no magic numbers live in the algorithm code (AGENTS.md Clause 2.8).
export const DEFAULT_MATCH_RADIUS_KM = 80; // fallback proximity when no explicit preference
export const MAX_MATCH_RADIUS_KM = 500; // hard ceiling on any requested radius
export const CONTENT_WEIGHT = 0.6; // blend weight: content-based vs collaborative
export const CF_WEIGHT = 0.4; // blend weight: collaborative vs content-based
export const MMR_LAMBDA = 0.7; // 0..1: relevance vs diversity tradeoff in MMR re-rank
export const PREMIUM_BOOST = 8; // points added to a Premium member's final score
export const NEW_USER_BOOST = 12; // points for accounts younger than NEW_USER_WINDOW_DAYS
export const NEW_USER_WINDOW_DAYS = 14;
export const COLD_START_LIKES = 5; // fewer recorded likes => treat viewer as cold-start
export const POPULARITY_ELO_K = 32; // Elo update factor for popularity normalization
export const ELO_INITIAL = 1500; // starting Elo for every profile
export const POPULARITY_ADJUST_MAX = 6; // max |points| from popularity damping (bias mitigation)
export const FAIRNESS_MIN_GROUP_RATIO = 0.2; // min exposure share reserved per protected group
export const RECOMMEND_TOP_N = 30; // default page size for GET /matches/recommend + discover
export const CF_SAMPLE_SIZE = 2000; // interaction rows sampled to build the CF matrix

// ── Profile (Technical Stack §3 Module 3) ──────────────────────────────────
export const PROFILE_MIN_PHOTOS = 3;
export const PROFILE_MAX_PHOTOS = 3;
export const BIO_MAX_LENGTH = 500;

// ── Onboarding enumerations (MVP scope: two SADC markets) ───────────────────
// Nationality dropdown is intentionally limited to the launch markets, listed
// alphabetically so the <select> renders in a stable, predictable order.
export const NATIONALITIES = ['South Africa', 'Zimbabwe'] as const;
export type Nationality = (typeof NATIONALITIES)[number];

// Common industries offered as tick-boxes during onboarding. Members may pick
// several ("I work across…"). Kept as a flat list; the Profile.industries
// column stores the selected string values.
export const INDUSTRIES = [
  'Technology',
  'Finance & Banking',
  'Healthcare',
  'Engineering',
  'Education',
  'Legal',
  'Marketing & Advertising',
  'Media & Communications',
  'Management Consulting',
  'Entrepreneur / Founder',
  'Government & Public Sector',
  'Hospitality & Tourism',
  'Retail & Consumer',
  'Construction & Real Estate',
  'Energy & Mining',
  'Agriculture',
  'Non-profit & NGO',
  'Creative & Arts',
  'Science & Research',
  'Other',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

// Proof-of-work submission methods accepted during vetting. The applicant picks
// ONE method, then supplies the matching artifact (upload or URL).
export const PROOF_OF_WORK_TYPES = [
  'resume', // résumé / CV upload
  'work_badge', // employee/work badge upload
  'selfie_company', // selfie taken at the workplace upload
  'linkedin', // LinkedIn profile URL
] as const;
export type ProofOfWorkType = (typeof PROOF_OF_WORK_TYPES)[number];

export const PROOF_OF_WORK_HINTS: Record<ProofOfWorkType, string> = {
  resume: 'Upload your CV/résumé (PDF or image). A LinkedIn URL is an alternative.',
  work_badge: 'Upload a photo of your staff/company badge. Blur out any sensitive ID numbers.',
  selfie_company: 'Upload a selfie of you at your workplace (desk, building, uniform).',
  linkedin: 'Paste your public LinkedIn profile URL so we can verify your role.',
};

// ── Membership tiers & visibility (discovery gating) ────────────────────────
// A free+vetted member may connect with at most this many premium+vetted
// members. Unfriending frees a slot but the cap itself is immutable for free
// members — only upgrading to Premium removes it.
export const FREE_PREMIUM_CONNECTION_LIMIT = 5;

// When a free+vetted member views a premium+vetted member's RedNote card, the
// profile pic (photos[0]) is ALWAYS shown and, on top of that, at most this
// many additional gallery photos are revealed. Total visible = 1 (hero) + this.
// e.g. value 1 => profile pic + 1 extra (2 photos in the carousel).
export const FREE_VIEW_MAX_EXTRA_PHOTOS = 1;

// Unverified (still-in-review) members may preview up to this many seeded,
// complete+verified discovery cards. Only the act of connecting is gated by
// vetting — browsing a curated sample is allowed to encourage profile completion.
export const DISCOVER_PREVIEW_LIMIT = 8;

// Nearby is ungated for any vetted member, but a free+vetted member only sees
// up to this many people around them (Premium/Platinum see the full list).
export const FREE_NEARBY_LIMIT = 2;

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

// ── Uploads (Change A; AGENTS.md Clause 3.7) ──────────────────────────────
// Magic bytes are the source of truth — never trust the client extension.
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const UPLOAD_MAX_FILES = 1;
export const UPLOAD_ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf'] as const;
export const UPLOAD_MAGIC_SIGNATURES: Record<string, number[]> = {
  jpg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  pdf: [0x25, 0x50, 0x44, 0x46],
};

// ── Profile views / analytics (Change C) ───────────────────────────────────
// Server-side de-duplication window so a single curious click cannot inflate
// another member's profile-view count (AGENTS.md §9.3).
export const PROFILE_VIEW_COOLDOWN_HOURS = 24;
export const ANALYTICS_WINDOWS = [7, 30, 90] as const; // selectable dashboards
export const ANALYTICS_DEFAULT_WINDOW = 30;

// ── Misc ───────────────────────────────────────────────────────────────────
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const CORS_ALLOWED_ORIGINS = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [
  'http://localhost:3000',
  'http://localhost:4000',
];
