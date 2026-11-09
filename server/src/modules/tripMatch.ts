import type { LatLng, PackageSize, Place, TripMatch } from '../../../shared/src/index.ts';
import { VEHICLE_SPEED_KMH, distanceKm, findBestDetour, minutesFor, quote } from '../../../shared/src/index.ts';
import { addMinutes } from '../lib/util.ts';
import type { TripRow } from './trips.ts';
import { tripPoints } from './trips.ts';

/** What the sender is trying to send (S1 + S2). */
export interface PackageSpec {
  size: PackageSize;
  pickup: LatLng;
  dropoff: LatLng;
  deliverBy?: string | null;
}

export type Evaluation =
  | { ok: true; match: Omit<TripMatch, 'trip'> }
  | { ok: false; reason: string };

/**
 * Decides whether a package fits a trip, and if so at what price and ETA.
 * Used by the S3 search, by the D3 inbox and again when an order is accepted,
 * so the three can never disagree.
 */
export function evaluateTrip(trip: TripRow, slotsUsed: number, spec: PackageSpec, now = new Date()): Evaluation {
  if (trip.status !== 'published' && trip.status !== 'ongoing') return { ok: false, reason: 'Rute tidak aktif' };
  const sizes = JSON.parse(trip.accepted_sizes_json) as PackageSize[];
  if (!sizes.includes(spec.size)) return { ok: false, reason: 'Ukuran paket tidak diterima' };
  if (slotsUsed >= trip.max_packages) return { ok: false, reason: 'Slot penuh' };

  const detour = findBestDetour(tripPoints(trip), spec.pickup, spec.dropoff, trip.max_detour_km);
  if (!detour.isMatch) return { ok: false, reason: `Simpangan ${detour.detourKm} km melebihi batas` };

  const speed = VEHICLE_SPEED_KMH[trip.vehicle_type];
  // Trips that already left use "now" as the clock start; good enough until live GPS ETAs.
  const start = new Date(Math.max(new Date(trip.depart_at).getTime(), now.getTime())).toISOString();
  const pickupAt = addMinutes(start, minutesFor(detour.kmToPickup, speed));
  const dropoffAt = addMinutes(start, minutesFor(detour.kmToDropoff, speed));
  if (spec.deliverBy && dropoffAt > spec.deliverBy) return { ok: false, reason: 'Tidak sempat sebelum batas waktu' };

  const price = quote({
    size: spec.size,
    packageKm: distanceKm(spec.pickup, spec.dropoff),
    detourKm: detour.detourKm,
    driverBand: trip.price_min !== null && trip.price_max !== null ? { min: trip.price_min, max: trip.price_max } : null,
  });

  return {
    ok: true,
    match: {
      kind: detour.kind,
      similarity: detour.similarity,
      detourKm: detour.detourKm,
      detourMinutes: minutesFor(detour.detourKm, speed),
      price,
      eta: { pickupAt, dropoffAt },
    },
  };
}

export const placeToLatLng = (p: Place): LatLng => ({ lat: p.lat, lng: p.lng });
