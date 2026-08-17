-- Change: add the VerificationToken table (email verification channel) and
-- set platform_settings.id default to 1 (singleton-row convention).
--
-- NOTE: the existing GIN index `profile_profiles_industries_idx` (created by
-- 20260813230000 via `USING GIN`) is intentionally left untouched. GIN indexes
-- cannot be expressed in Prisma schema, and dropping it would break the
-- industry `hasSome`/`@>` filter queries. It is managed by that raw migration.

-- platform_settings.id must default to 1 so the singleton seed/config row is implicit.
ALTER TABLE "platform_settings" ALTER COLUMN "id" SET DEFAULT 1;

-- Email verification tokens (PRIMARY verification channel). A token is emailed as
-- a link; redeeming it sets User.emailVerified. Distinct from the SMS OTP store.
CREATE TABLE "auth_verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'email_verify',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_verification_tokens_tokenHash_key" ON "auth_verification_tokens"("tokenHash");

CREATE INDEX "auth_verification_tokens_userId_idx" ON "auth_verification_tokens"("userId");

ALTER TABLE "auth_verification_tokens" ADD CONSTRAINT "auth_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- down
-- ALTER TABLE "auth_verification_tokens" DROP CONSTRAINT "auth_verification_tokens_userId_fkey";
-- DROP INDEX "auth_verification_tokens_userId_idx";
-- DROP INDEX "auth_verification_tokens_tokenHash_key";
-- DROP TABLE "auth_verification_tokens";
-- ALTER TABLE "platform_settings" ALTER COLUMN "id" DROP DEFAULT;
