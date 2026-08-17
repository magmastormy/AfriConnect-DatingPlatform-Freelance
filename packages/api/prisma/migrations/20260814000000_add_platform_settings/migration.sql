-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL,
    "freeViewMaxExtraPhotos" INTEGER NOT NULL DEFAULT 1,
    "freePremiumConnectionLimit" INTEGER NOT NULL DEFAULT 5,
    "restrictedHiddenFields" TEXT[] NOT NULL DEFAULT '{nationality,profession,educationLevel,dateOfBirth}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so the API has a row to read/update without a race.
INSERT INTO "platform_settings" ("id", "freeViewMaxExtraPhotos", "freePremiumConnectionLimit", "restrictedHiddenFields", "updatedAt")
VALUES (1, 1, 5, '{nationality,profession,educationLevel,dateOfBirth}', now());

-- CreateIndex (singleton guard)
-- (no secondary indexes needed; the row is always read by its fixed primary key)
