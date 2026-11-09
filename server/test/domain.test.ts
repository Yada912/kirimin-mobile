import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, distanceKm, estimateRange, findBestDetour, nextStatuses, quote, refundFor } from '../../shared/src/index.ts';
import { PLACES } from '../src/db/seed.ts';

test('distanceKm: Renon → Kampus Bukit is roughly 15 km as the crow flies', () => {
  const km = distanceKm(PLACES.renon, PLACES.kampusBukit);
  assert.ok(km > 13 && km < 17, `got ${km}`);
});

test('findBestDetour: a package along the route is a "direct" match', () => {
  const route = [PLACES.renon, PLACES.sesetan, PLACES.dewaRuci, PLACES.kampusBukit];
  const r = findBestDetour(route, PLACES.tukadBadung, PLACES.gedungFT, 2);
  assert.equal(r.isMatch, true);
  assert.ok(r.detourKm < 1, `detour ${r.detourKm}`);
  assert.ok(r.pickupIndex < r.dropoffIndex);
  assert.equal(r.route.length, route.length + 2);
});

test('findBestDetour: a package in the opposite direction is rejected', () => {
  const route = [PLACES.renon, PLACES.sesetan, PLACES.kampusBukit];
  const r = findBestDetour(route, PLACES.nusaDua, PLACES.sanur, 2);
  assert.equal(r.isMatch, false);
  assert.equal(r.similarity, 0);
});

test('pricing stays inside the Figma range for a typical XS trip and respects driver bands', () => {
  const km = distanceKm(PLACES.tukadBadung, PLACES.gedungFT);
  const { min, max } = estimateRange('XS', km);
  assert.ok(min >= 5000 && max <= 15000, `${min}–${max}`);
  assert.equal(min % 500, 0);
  const banded = quote({ size: 'L', packageKm: 30, detourKm: 3, driverBand: { min: 6000, max: 9000 } });
  assert.equal(banded.fee, 9000);
  assert.equal(banded.total, 10000);
});

test('refunds: full before acceptance, minus compensation after', () => {
  assert.deepEqual(refundFor(9000, false), { refund: 9000, compensation: 0 });
  assert.deepEqual(refundFor(9000, true), { refund: 7000, compensation: 2000 });
});

test('order state machine: only the right actor can move an order', () => {
  assert.ok(canTransition('requested', 'accepted', 'driver'));
  assert.ok(!canTransition('requested', 'accepted', 'sender'));
  assert.ok(!canTransition('picked_up', 'cancelled', 'sender'));
  assert.ok(canTransition('arrived', 'delivered', 'driver'));
  assert.deepEqual(nextStatuses('accepted', 'sender'), ['cancelled']);
});
