-- Make Profile.dateOfBirth nullable so a member can save a partial profile
-- from the account page (account-first onboarding) before capturing a full DOB.
-- See profile.schema.ts updateProfileSchema and profile.routes.ts comment.
--
-- NOTE: the Prisma model `Profile` is mapped to the physical table
-- `profile_profiles` (@@map, per AGENTS.md Clause 1.4 module-prefixed tables).
-- This statement previously targeted "Profile", which does not exist, so the
-- migration aborted with `relation "Profile" does not exist` and the column was
-- left NOT NULL in every environment.
-- `DROP NOT NULL` is idempotent in PostgreSQL, so re-running it is safe.

ALTER TABLE "profile_profiles" ALTER COLUMN "dateOfBirth" DROP NOT NULL;
