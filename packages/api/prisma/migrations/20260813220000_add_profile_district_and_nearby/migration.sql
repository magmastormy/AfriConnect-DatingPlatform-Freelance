-- Change: WeChat-Nearby (district-scoped, premium discovery feature)
-- Adds the opt-in + location fields to the profile module.

-- Profile.district: free-text suburb/neighbourhood within the city.
ALTER TABLE "profile_profiles" ADD COLUMN "district" TEXT;

-- Profile.nearbyEnabled: member opt-in for WeChat-Nearby discovery.
-- Only profiles with this true are returned to nearby viewers.
ALTER TABLE "profile_profiles" ADD COLUMN "nearbyEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Compound index to serve same-district, opt-in queries efficiently.
CREATE INDEX "profile_profiles_city_district_nearbyEnabled_idx"
  ON "profile_profiles" ("city", "district", "nearbyEnabled");

-- down
-- DROP INDEX "profile_profiles_city_district_nearbyEnabled_idx";
-- ALTER TABLE "profile_profiles" DROP COLUMN "nearbyEnabled";
-- ALTER TABLE "profile_profiles" DROP COLUMN "district";
