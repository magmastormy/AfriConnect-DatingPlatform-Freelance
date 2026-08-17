/**
 * geo.ts — geographic proximity (breakdown §1: "Geographic proximity").
 *
 * Replaces the legacy exact-city hard filter with a true distance-radius filter
 * using the haversine formula. When coordinates are missing we fall back to an
 * exact-city match so discovery still works for members who opted out of
 * WeChat-Nearby geolocation.
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometres between two lat/long points. */
export function haversineKm(
  a: { latitude?: number | null; longitude?: number | null },
  b: { latitude?: number | null; longitude?: number | null },
): number | null {
  if (
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null
  ) {
    return null; // insufficient coordinates — caller must fall back
  }
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * True when `candidate` is within `radiusKm` of `viewer`. Falls back to an
 * exact-city equality check when either side lacks coordinates.
 */
export function withinRadius(
  viewer: { latitude?: number | null; longitude?: number | null; city?: string },
  candidate: { latitude?: number | null; longitude?: number | null; city?: string },
  radiusKm: number,
): boolean {
  const distance = haversineKm(viewer, candidate);
  if (distance == null) {
    return viewer.city != null && viewer.city === candidate.city;
  }
  return distance <= radiusKm;
}
