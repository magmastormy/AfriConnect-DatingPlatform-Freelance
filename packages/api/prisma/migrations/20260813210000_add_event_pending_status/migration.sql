-- Add a 'pending' status for member-submitted events awaiting admin approval.
-- Members create events with status 'pending'; admins publish/cancel via the
-- existing moderation endpoint. This keeps the curated calendar clean.

ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'pending';

-- Down migration is intentionally omitted: removing an enum value in Postgres is
-- non-trivial (requires dropping/recreating the type and rewriting columns). The
-- value is additive and harmless if left in place.
