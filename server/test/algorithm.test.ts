/**
 * Property tests for the matching, pricing and order-flow rules.
 *
 * The example tests in domain.test.ts check a few known Bali trips. These throw a few
 * thousand random routes and packages at the same functions and check the rules that
 * must hold for every input: the detour is never negative, the pickup comes before the
 * drop-off, a bigger allowance never turns a match into a non-match, prices only go up
 * with distance, and so on. A seeded random generator keeps failures reproducible.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_ORDER_STATUSES,
  FINAL_ORDER_STATUSES,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  PACKAGE_SIZES,
  PRICING,
  canTransition,
  distanceKm,
  estimateRange,
  findBestDetour,
  pathKm,
  quote,
} from '../../shared/src/index.ts';
import type { LatLng, OrderStatus, PackageSize } from '../../shared/src/index.ts';
import { evaluateTrip } from '../src/modules/tripMatch.ts';
import type { TripRow } from '../src/modules/trips.ts';
import { PLACES } from '../src/db/seed.ts';

// ─── helpers ────────────────────────────────────────────────────────────────

/** mulberry32: tiny seeded PRNG so a failing case can be replayed. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random point in the South Bali service area. */
const point = (r: () => number): LatLng => ({ lat: -8.86 + r() * 0.31, lng: 115.08 + r() * 0.24 });
const route = (r: () => number, n: number): LatLng[] => Array.from({ length: n }, () => point(r));
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const samePoint = (a: LatLng, b: LatLng) => near(a.lat, b.lat) && near(a.lng, b.lng);

const CASES = 2000;

// ─── findBestDetour ─────────────────────────────────────────────────────────

test('findBestDetour: invariants hold for random routes and packages', () => {
  const r = rng(42);
  for (let k = 0; k < CASES; k++) {
    const wp = route(r, 2 + Math.floor(r() * 4)); // 2–5 waypoints
    const p = point(r);
    const d = point(r);
    const res = findBestDetour(wp, p, d, 2);
    const ctx = `case ${k}`;

    assert.ok(res.detourKm >= 0, `${ctx}: negative detour ${res.detourKm}`);
    assert.ok(res.pickupIndex < res.dropoffIndex, `${ctx}: drop-off before pickup`);
    assert.equal(res.route.length, wp.length + 2, ctx);
    assert.ok(samePoint(res.route[0], wp[0]), `${ctx}: the driver's start moved`);
    assert.ok(samePoint(res.route[res.pickupIndex], p), `${ctx}: pickup not at pickupIndex`);
    assert.ok(samePoint(res.route[res.dropoffIndex], d), `${ctx}: drop-off not at dropoffIndex`);
    // The reported detour is exactly the extra length of the returned route (to 2 dp).
    assert.ok(Math.abs(pathKm(res.route) - pathKm(wp) - res.detourKm) < 0.011, `${ctx}: detour mismatch`);
    assert.ok(res.kmToPickup <= res.kmToDropoff + 1e-9, `${ctx}: reaches drop-off before pickup`);
    if (res.isMatch) {
      assert.ok(res.similarity >= 10 && res.similarity <= 100, `${ctx}: similarity ${res.similarity}`);
    } else {
      assert.equal(res.similarity, 0, ctx);
    }
  }
});

test('findBestDetour: the chosen insertion is the cheapest of all legal ones', () => {
  const r = rng(7);
  for (let k = 0; k < 300; k++) {
    const wp = route(r, 2 + Math.floor(r() * 4));
    const p = point(r);
    const d = point(r);
    const res = findBestDetour(wp, p, d, 100);
    let best = Infinity;
    for (let i = 1; i <= wp.length; i++) {
      for (let j = i; j <= wp.length; j++) {
        const rt = [...wp];
        rt.splice(i, 0, p);
        rt.splice(j + 1, 0, d);
        best = Math.min(best, pathKm(rt) - pathKm(wp));
      }
    }
    assert.ok(Math.abs(best - res.detourKm) < 0.006, `case ${k}: ${res.detourKm} vs optimum ${best}`);
  }
});

test('findBestDetour: a package picked up and dropped on the route itself costs nothing', () => {
  const r = rng(99);
  for (let k = 0; k < 500; k++) {
    const wp = route(r, 3 + Math.floor(r() * 3));
    // Pick two points that lie on the route, in driving order.
    const seg = Math.floor(r() * (wp.length - 1));
    const t1 = r() * 0.5;
    const t2 = 0.5 + r() * 0.5;
    const on = (t: number) => ({
      lat: wp[seg].lat + (wp[seg + 1].lat - wp[seg].lat) * t,
      lng: wp[seg].lng + (wp[seg + 1].lng - wp[seg].lng) * t,
    });
    const res = findBestDetour(wp, on(t1), on(t2), 2);
    assert.ok(res.detourKm < 0.05, `case ${k}: detour ${res.detourKm}`);
    assert.equal(res.kind, 'direct');
    assert.equal(res.isMatch, true);
  }
});

test('findBestDetour: a bigger detour allowance never loses a match, and similarity falls with detour', () => {
  const r = rng(2024);
  for (let k = 0; k < 500; k++) {
    const wp = route(r, 3);
    const p = point(r);
    const d = point(r);
    let wasMatch = false;
    for (const max of [0.5, 1, 2, 3, 5, 10]) {
      const m = findBestDetour(wp, p, d, max).isMatch;
      assert.ok(!(wasMatch && !m), `case ${k}: lost match when allowance grew to ${max}`);
      wasMatch = m;
    }
  }
  const wp = [PLACES.renon, PLACES.sesetan, PLACES.kampusBukit];
  const close = findBestDetour(wp, PLACES.tukadBadung, PLACES.gedungFT, 5);
  const far = findBestDetour(wp, PLACES.sanur, PLACES.gedungFT, 5);
  assert.ok(close.detourKm < far.detourKm);
  assert.ok(close.similarity >= far.similarity);
});

test('findBestDetour: rejects an empty route', () => {
  assert.throws(() => findBestDetour([], PLACES.renon, PLACES.sanur));
});

// ─── pricing ────────────────────────────────────────────────────────────────

test('pricing: fee is a multiple of Rp 500, inside the global band, total = fee + service fee', () => {
  const r = rng(5);
  for (let k = 0; k < CASES; k++) {
    const size = PACKAGE_SIZES[Math.floor(r() * PACKAGE_SIZES.length)] as PackageSize;
    const q = quote({ size, packageKm: r() * 40, detourKm: r() * 6 });
    assert.equal(q.fee % PRICING.roundTo, 0, `fee ${q.fee}`);
    assert.ok(q.fee >= PRICING.min && q.fee <= PRICING.max, `fee ${q.fee}`);
    assert.equal(q.total, q.fee + PRICING.serviceFee);
  }
});

test('pricing: never cheaper for a longer trip, a bigger detour or a bigger package', () => {
  const r = rng(11);
  for (let k = 0; k < CASES; k++) {
    const km = r() * 30;
    const det = r() * 4;
    const base = quote({ size: 'S', packageKm: km, detourKm: det }).fee;
    assert.ok(quote({ size: 'S', packageKm: km + 1 + r() * 5, detourKm: det }).fee >= base, 'longer trip got cheaper');
    assert.ok(quote({ size: 'S', packageKm: km, detourKm: det + 0.5 + r() * 2 }).fee >= base, 'bigger detour got cheaper');
  }
  const fees = PACKAGE_SIZES.map((s) => quote({ size: s as PackageSize, packageKm: 8, detourKm: 1 }).fee);
  for (let i = 1; i < fees.length; i++) assert.ok(fees[i] >= fees[i - 1], `sizes ${fees.join(' < ')}`);
});

test('pricing: a driver band always wins, and the estimate range brackets the real quote', () => {
  const r = rng(13);
  for (let k = 0; k < 500; k++) {
    const lo = 5000 + Math.floor(r() * 6) * 500;
    const hi = lo + Math.floor(r() * 10) * 500;
    const q = quote({ size: 'M', packageKm: r() * 40, detourKm: r() * 5, driverBand: { min: lo, max: hi } });
    assert.ok(q.fee >= lo && q.fee <= hi, `${q.fee} outside ${lo}–${hi}`);
  }
  const km = distanceKm(PLACES.tukadBadung, PLACES.gedungFT);
  const range = estimateRange('XS', km, 2);
  for (const det of [0, 0.5, 1, 1.5, 2]) {
    const fee = quote({ size: 'XS', packageKm: km, detourKm: det }).fee;
    assert.ok(fee >= range.min && fee <= range.max, `${fee} outside ${range.min}–${range.max}`);
  }
});

// ─── evaluateTrip (the single place search, inbox and accept all use) ──────

function trip(over: Partial<TripRow> = {}): TripRow {
  const now = new Date('2026-11-23T00:00:00Z');
  return {
    id: 't1',
    driver_id: 'd1',
    name: 'Ke Kampus',
    origin_json: JSON.stringify(PLACES.renon),
    stops_json: JSON.stringify([PLACES.sesetan, PLACES.dewaRuci]),
    destination_json: JSON.stringify(PLACES.kampusBukit),
    depart_at: new Date(now.getTime() + 3600_000).toISOString(),
    arrive_at: new Date(now.getTime() + 7200_000).toISOString(),
    repeat_days_json: '[]',
    vehicle_type: 'motor',
    vehicle_plate: 'DK 1101 XL',
    accepted_sizes_json: JSON.stringify(['XS', 'S']),
    max_packages: 3,
    max_weight_kg: null,
    max_detour_km: 2,
    price_min: null,
    price_max: null,
    status: 'published',
    last_lat: null,
    last_lng: null,
    last_location_at: null,
    series_id: 's1',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...over,
  };
}
const NOW = new Date('2026-11-23T00:00:00Z');
const spec = { size: 'XS' as PackageSize, pickup: PLACES.tukadBadung, dropoff: PLACES.gedungFT };

test('evaluateTrip: a package along the route matches with a sane price and ETA', () => {
  const e = evaluateTrip(trip(), 0, spec, NOW);
  assert.equal(e.ok, true);
  if (!e.ok) return;
  assert.equal(e.match.kind, 'direct');
  assert.ok(e.match.eta.pickupAt <= e.match.eta.dropoffAt, 'drop-off before pickup');
  assert.ok(e.match.eta.pickupAt >= trip().depart_at, 'pickup before the trip leaves');
  assert.equal(e.match.price.total, e.match.price.fee + PRICING.serviceFee);
});

test('evaluateTrip: rejects for each rule that can fail', () => {
  const cases: [string, ReturnType<typeof evaluateTrip>][] = [
    ['trip not active', evaluateTrip(trip({ status: 'completed' }), 0, spec, NOW)],
    ['size not accepted', evaluateTrip(trip(), 0, { ...spec, size: 'L' }, NOW)],
    ['slots full', evaluateTrip(trip(), 3, spec, NOW)],
    ['too far off the route', evaluateTrip(trip(), 0, { ...spec, pickup: PLACES.sanur, dropoff: PLACES.nusaDua }, NOW)],
    ['deadline too early', evaluateTrip(trip(), 0, { ...spec, deliverBy: NOW.toISOString() }, NOW)],
  ];
  for (const [name, e] of cases) assert.equal(e.ok, false, `${name} should be rejected`);
});

test('evaluateTrip: a trip that already left starts its ETA from now, not from its departure', () => {
  const left = trip({ depart_at: '2026-11-22T00:00:00Z', status: 'ongoing' });
  const e = evaluateTrip(left, 0, spec, NOW);
  assert.equal(e.ok, true);
  if (e.ok) assert.ok(e.match.eta.pickupAt >= NOW.toISOString());
});

test('evaluateTrip: the driver price band is respected', () => {
  const e = evaluateTrip(trip({ price_min: 9000, price_max: 9000 }), 0, spec, NOW);
  assert.equal(e.ok, true);
  if (e.ok) assert.equal(e.match.price.fee, 9000);
});

// ─── order state machine ────────────────────────────────────────────────────

test('order flow: nothing leaves a final state, and every move belongs to the right actor', () => {
  for (const from of FINAL_ORDER_STATUSES) {
    for (const to of ORDER_STATUSES) {
      for (const actor of ['sender', 'driver', 'system'] as const) {
        assert.equal(canTransition(from, to as OrderStatus, actor), false, `${from} → ${to} by ${actor}`);
      }
    }
  }
  for (const t of ORDER_TRANSITIONS) {
    if (['picked_up', 'in_transit', 'arrived', 'delivered'].includes(t.to)) {
      assert.deepEqual(t.by, ['driver'], `only the driver moves a package (${t.from} → ${t.to})`);
    }
  }
  assert.equal(canTransition('arrived', 'delivered', 'sender'), false, 'the sender cannot mark it delivered');
  assert.equal(canTransition('picked_up', 'cancelled', 'sender'), false, 'no cancelling once picked up');
});

test('order flow: delivery is reachable from every non-final status', () => {
  const next = new Map<string, string[]>();
  for (const t of ORDER_TRANSITIONS) next.set(t.from, [...(next.get(t.from) ?? []), t.to]);
  for (const start of ORDER_STATUSES) {
    if ((FINAL_ORDER_STATUSES as string[]).includes(start)) continue;
    const seen = new Set<string>([start]);
    const queue = [start as string];
    while (queue.length) for (const n of next.get(queue.shift()!) ?? []) if (!seen.has(n)) seen.add(n), queue.push(n);
    assert.ok(seen.has('delivered'), `${start} can never be delivered`);
  }
  for (const s of ACTIVE_ORDER_STATUSES) assert.ok(!(FINAL_ORDER_STATUSES as string[]).includes(s));
});
