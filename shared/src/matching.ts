import type { LatLng } from './domain.ts';
import { pathKm, pathKmUntil, round } from './geo.ts';

/** Below this detour a match is shown as "Langsung" (on the route), above it as "Simpangan". */
export const DIRECT_DETOUR_KM = 0.5;
export const DEFAULT_MAX_DETOUR_KM = 2;

export type MatchKind = 'direct' | 'detour';

export interface DetourResult {
  /** True if the detour is within `maxDetourKm`. */
  isMatch: boolean;
  kind: MatchKind;
  /** Extra km the driver has to travel to carry this package. */
  detourKm: number;
  /** 10–100, shown as "94% kemiripan rute". */
  similarity: number;
  /** Index of the pickup / drop-off in `route`. */
  pickupIndex: number;
  dropoffIndex: number;
  /** Driver's route with the pickup and drop-off inserted. */
  route: LatLng[];
  /** Straight-line km from the driver's start to the pickup / drop-off along `route`. */
  kmToPickup: number;
  kmToDropoff: number;
}

/**
 * Finds the cheapest way to insert a pickup (P) and drop-off (D) into a driver's
 * route W1 → … → Wn, keeping P before D and the route's start fixed.
 *
 * Brute force over all (i, j) insertion positions: O(n²) route evaluations, which is
 * fine for commuter routes with a handful of stops.
 */
export function findBestDetour(
  waypoints: LatLng[],
  pickup: LatLng,
  dropoff: LatLng,
  maxDetourKm: number = DEFAULT_MAX_DETOUR_KM,
): DetourResult {
  if (waypoints.length === 0) throw new Error('A route needs at least one waypoint');

  const base = pathKm(waypoints);
  let best: { detour: number; route: LatLng[]; p: number; d: number } | null = null;

  // Pickup goes after the start (i ≥ 1); the route may end at the drop-off (j ≤ n).
  const n = waypoints.length;
  for (let i = 1; i <= n; i++) {
    for (let j = i; j <= n; j++) {
      const route = [...waypoints];
      route.splice(i, 0, pickup);
      route.splice(j + 1, 0, dropoff);
      const detour = pathKm(route) - base;
      if (best === null || detour < best.detour) best = { detour, route, p: i, d: j + 1 };
    }
  }

  // `best` is always set because n ≥ 1 gives at least one (i, j) pair.
  const b = best!;
  const detourKm = round(Math.max(0, b.detour), 2);
  const isMatch = detourKm <= maxDetourKm;
  const similarity = isMatch ? Math.max(10, Math.min(100, Math.round((1 - detourKm / maxDetourKm) * 90) + 10)) : 0;

  return {
    isMatch,
    kind: detourKm <= DIRECT_DETOUR_KM ? 'direct' : 'detour',
    detourKm,
    similarity,
    pickupIndex: b.p,
    dropoffIndex: b.d,
    route: b.route,
    kmToPickup: round(pathKmUntil(b.route, b.p), 2),
    kmToDropoff: round(pathKmUntil(b.route, b.d), 2),
  };
}
