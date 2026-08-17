-- Change: WeChat-Nearby geolocation
-- Adds precise lat/long to the profile so the Nearby surface can be driven by
-- the member's shared browser location, not just a free-text district.

-- Profile.latitude / Profile.longitude: captured from navigator.geolocation
-- when a member opts into Nearby. Both nullable so a profile without a shared
-- location is still valid.
ALTER TABLE "profile_profiles" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "profile_profiles" ADD COLUMN "longitude" DOUBLE PRECISION;

-- Index to serve location-scoped queries efficiently.
CREATE INDEX "profile_profiles_nearbyEnabled_latitude_longitude_idx"
  ON "profile_profiles" ("nearbyEnabled", "latitude", "longitude");

-- down
-- DROP INDEX "profile_profiles_nearbyEnabled_latitude_longitude_idx";
-- ALTER TABLE "profile_profiles" DROP COLUMN "longitude";
-- ALTER TABLE "profile_profiles" DROP COLUMN "latitude";
