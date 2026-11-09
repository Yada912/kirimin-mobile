import type { LatLng } from './domain.ts';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in km (Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Total length of a polyline, in km. */
export function pathKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceKm(points[i - 1], points[i]);
  return total;
}

/** Distance travelled along `points` from the start until reaching index `index`, in km. */
export function pathKmUntil(points: LatLng[], index: number): number {
  return pathKm(points.slice(0, index + 1));
}

/**
 * Straight-line distance underestimates real roads. Until OSRM routing is wired in,
 * multiply by this factor for ETAs and prices (≈1.3 is a common urban circuity value).
 */
export const ROAD_FACTOR = 1.3;

export function minutesFor(km: number, speedKmh: number): number {
  return Math.round(((km * ROAD_FACTOR) / speedKmh) * 60);
}

export function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
