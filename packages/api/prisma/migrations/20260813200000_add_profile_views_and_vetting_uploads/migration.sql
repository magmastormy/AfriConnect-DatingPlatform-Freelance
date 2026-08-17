-- Change C: ProfileView model (analytics module)
-- Change B: relax Application required fields + add proofOfWorkUrl

-- CreateTable
CREATE TABLE "analytics_profile_views" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_profile_views_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "analytics_profile_views" ADD CONSTRAINT "analytics_profile_views_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_profile_views" ADD CONSTRAINT "analytics_profile_views_viewedUserId_fkey" FOREIGN KEY ("viewedUserId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "analytics_profile_views_viewerId_createdAt_idx" ON "analytics_profile_views"("viewerId", "createdAt");
CREATE INDEX "analytics_profile_views_viewedUserId_createdAt_idx" ON "analytics_profile_views"("viewedUserId", "createdAt");

-- Application: relax required fields + add proofOfWorkUrl (Change B)
ALTER TABLE "vetting_applications" ALTER COLUMN "linkedInUrl" DROP NOT NULL;
ALTER TABLE "vetting_applications" ALTER COLUMN "relationshipGoals" DROP NOT NULL;
ALTER TABLE "vetting_applications" ALTER COLUMN "degreeCertificateUrl" DROP NOT NULL;
ALTER TABLE "vetting_applications" ADD COLUMN "proofOfWorkUrl" TEXT;

-- ---------------------------------------------------------------------------
-- down
-- DROP TABLE "analytics_profile_views";
-- ALTER TABLE "vetting_applications" ALTER COLUMN "linkedInUrl" SET NOT NULL;
-- ALTER TABLE "vetting_applications" ALTER COLUMN "relationshipGoals" SET NOT NULL;
-- ALTER TABLE "vetting_applications" ALTER COLUMN "degreeCertificateUrl" SET NOT NULL;
-- ALTER TABLE "vetting_applications" DROP COLUMN "proofOfWorkUrl";
