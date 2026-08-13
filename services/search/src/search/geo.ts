import type { GeoLocation } from '@learn-and-build/types';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance in metres. Mirrors the semantics of PostGIS
 * ST_Distance on geography, used for the in-memory ranking/tests path.
 */
export function haversineMeters(a: GeoLocation, b: GeoLocation): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Equivalent of ST_DWithin(a, b, radiusMeters). */
export function withinRadius(
  a: GeoLocation,
  b: GeoLocation,
  radiusMeters: number,
): boolean {
  return haversineMeters(a, b) <= radiusMeters;
}
