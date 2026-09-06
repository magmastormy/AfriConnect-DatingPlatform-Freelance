/**
 * geo.ts — geographic proximity (breakdown §1: "Geographic proximity").
 *
 * True distance-radius filter using the haversine formula. When profile coordinates
 * are omitted, falls back to canonical coordinates for known African cities so
 * neighboring cities (e.g. Johannesburg & Pretoria at ~55km, Durban & Pietermaritzburg at ~68km)
 * are recognized as within proximity rather than arbitrarily excluded.
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Canonical centroid coordinates for major African metropolitan areas. */
export const KNOWN_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  johannesburg: { lat: -26.2041, lng: 28.0473 },
  pretoria: { lat: -25.7479, lng: 28.2293 },
  cape_town: { lat: -33.9249, lng: 18.4241 },
  durban: { lat: -29.8587, lng: 31.0218 },
  pietermaritzburg: { lat: -29.6006, lng: 30.3794 },
  gqeberha: { lat: -33.9608, lng: 25.6022 },
  bloemfontein: { lat: -29.0852, lng: 26.1596 },
  east_london: { lat: -33.0153, lng: 27.893 },
  nairobi: { lat: -1.2921, lng: 36.8219 },
  lagos: { lat: 6.5244, lng: 3.3792 },
  accra: { lat: 5.6037, lng: -0.187 },
  kigali: { lat: -1.9706, lng: 30.1044 },
  harare: { lat: -17.8252, lng: 31.0335 },
  kampala: { lat: 0.3476, lng: 32.5825 },
};

function resolveCoords(item: {
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
}): { lat: number; lng: number } | null {
  if (item.latitude != null && item.longitude != null) {
    return { lat: item.latitude, lng: item.longitude };
  }
  if (item.city) {
    const key = item.city.toLowerCase().replace(/[\s-]+/g, '_');
    const known = KNOWN_CITY_COORDINATES[key];
    if (known) return known;
  }
  return null;
}

/** Great-circle distance in kilometres between two locations. */
export function haversineKm(
  a: { latitude?: number | null; longitude?: number | null; city?: string | null },
  b: { latitude?: number | null; longitude?: number | null; city?: string | null },
): number | null {
  const cA = resolveCoords(a);
  const cB = resolveCoords(b);
  if (!cA || !cB) {
    // If same city but unknown coords, effective distance is ~0
    if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) {
      return 0;
    }
    return null;
  }
  const dLat = toRad(cB.lat - cA.lat);
  const dLon = toRad(cB.lng - cA.lng);
  const lat1 = toRad(cA.lat);
  const lat2 = toRad(cB.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))));
}

/**
 * True when `candidate` is within `radiusKm` of `viewer`.
 * Also true if both are in the same city.
 */
export function withinRadius(
  viewer: { latitude?: number | null; longitude?: number | null; city?: string | null },
  candidate: { latitude?: number | null; longitude?: number | null; city?: string | null },
  radiusKm: number,
): boolean {
  if (viewer.city && candidate.city && viewer.city.toLowerCase() === candidate.city.toLowerCase()) {
    return true;
  }
  const distance = haversineKm(viewer, candidate);
  if (distance == null) return false;
  return distance <= radiusKm;
}
