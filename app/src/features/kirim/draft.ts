/**
 * The Kirim flow (S1 Paket → S2 Rute → S3 Driver → S4 Konfirmasi) passes its
 * draft between screens as expo-router params, which are always strings
 * (objects are JSON-encoded). This module is the single place that reads that
 * draft back and turns it into API request bodies.
 *
 * Pure TypeScript, no React Native imports, so the contract tests in
 * app/tests/contract run it with plain Node against the real server.
 */
import type {
  Category,
  HandlingFlag,
  HandoverMethod,
  PackageSize,
  PaymentMethod,
  Place,
  TripMatch,
  WeightClass,
} from '@kirimin/shared';

/** Route params exactly as `useLocalSearchParams()` returns them. */
export type RouteParams = Record<string, string | string[] | undefined>;

export interface KirimDraft {
  category: Category;
  size: PackageSize;
  weightClass: WeightClass;
  handling: HandlingFlag[];
  notes: string;
  photoUrl: string | null;
  pickup: Place | null;
  dropoff: Place | null;
  recipient: { name: string; phone: string } | null;
  handoverMethod: HandoverMethod;
  /** Set when the sender picked a driver on S3; empty for an open request (S6). */
  tripId: string | null;
  match: TripMatch | null;
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

function fromJson<T>(v: string | string[] | undefined, fallback: T): T {
  const s = first(v);
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function readKirimDraft(params: RouteParams): KirimDraft {
  return {
    category: (first(params.category) as Category) || 'Dokumen',
    size: (first(params.size) as PackageSize) || 'XS',
    weightClass: (first(params.weightClass) as WeightClass) || 'lt1',
    handling: fromJson<HandlingFlag[]>(params.handling, []),
    notes: first(params.notes) ?? '',
    photoUrl: first(params.photoUrl) || null,
    pickup: fromJson<Place | null>(params.pickup, null),
    dropoff: fromJson<Place | null>(params.dropoff, null),
    recipient: fromJson<{ name: string; phone: string } | null>(params.recipient, null),
    handoverMethod: (first(params.handoverMethod) as HandoverMethod) || 'meet',
    tripId: first(params.tripId) || null,
    match: fromJson<TripMatch | null>(params.matchData, null),
  };
}

/** Body for POST /matches/search (S3). */
export function searchPayload(d: KirimDraft) {
  if (!d.pickup || !d.dropoff) throw new Error('Titik jemput dan antar belum dipilih');
  return {
    size: d.size,
    pickup: { lat: d.pickup.lat, lng: d.pickup.lng },
    dropoff: { lat: d.dropoff.lat, lng: d.dropoff.lng },
  };
}

/** Body for POST /orders (S4). Without a tripId it becomes an open request (S6). */
export function orderPayload(d: KirimDraft, paymentMethod: PaymentMethod) {
  if (!d.pickup || !d.dropoff) throw new Error('Titik jemput dan antar belum dipilih');
  if (!d.recipient) throw new Error('Data penerima belum diisi');
  return {
    category: d.category,
    size: d.size,
    weightClass: d.weightClass,
    handling: d.handling,
    ...(d.photoUrl ? { photoUrl: d.photoUrl } : {}),
    notes: d.notes,
    pickup: d.pickup,
    dropoff: d.dropoff,
    recipient: d.recipient,
    handoverMethod: d.handoverMethod,
    paymentMethod,
    ...(d.tripId ? { tripId: d.tripId } : {}),
  };
}

/**
 * Price shown on S4. A chosen driver's quote is final; an open request has no
 * price until a driver accepts it, so return null instead of inventing one.
 */
export function confirmPrice(d: KirimDraft): { fee: number; serviceFee: number; total: number } | null {
  return d.tripId && d.match ? d.match.price : null;
}
