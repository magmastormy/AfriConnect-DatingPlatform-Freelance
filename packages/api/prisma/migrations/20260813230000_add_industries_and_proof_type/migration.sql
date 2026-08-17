-- Add Profile.industries (multi-select) and Application.proofOfWorkType.
-- Generated for Aiven PostgreSQL (requires ?sslmode=require on DATABASE_URL).

ALTER TABLE "profile_profiles" ADD COLUMN "industries" TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX "profile_profiles_industries_idx" ON "profile_profiles" USING GIN ("industries");

ALTER TABLE "profile_profiles" ADD COLUMN "nationality" TEXT;

ALTER TABLE "vetting_applications" ADD COLUMN "proofOfWorkType" TEXT;

-- Down migration
-- DROP INDEX "profile_profiles_industries_idx";
-- ALTER TABLE "profile_profiles" DROP COLUMN "industries";
-- ALTER TABLE "profile_profiles" DROP COLUMN "nationality";
-- ALTER TABLE "vetting_applications" DROP COLUMN "proofOfWorkType";
