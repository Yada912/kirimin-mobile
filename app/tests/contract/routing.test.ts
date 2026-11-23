import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaliFallbackRoute,
  computeBearing,
  computeDriverRouteProgress,
  formatStepDistance,
} from '../../src/utils/routing.ts';
import { PLACE_BY_ID } from '../../src/constants/places.ts';

test('Bali road graph builds a multi-point arterial road route with turn-by-turn steps', () => {
  const route = buildBaliFallbackRoute([
    PLACE_BY_ID.tukad_badung,
    PLACE_BY_ID.sesetan,
    PLACE_BY_ID.gedung_ft,
  ]);
  assert.equal(route.source, 'bali-road-graph');
  assert.ok(route.coordinates.length > 15, `expected dense road polyline, got ${route.coordinates.length}`);
  assert.ok(route.distanceKm > 10 && route.distanceKm < 30, `unexpected distance ${route.distanceKm} km`);
  assert.ok(route.durationMin >= 15, `unexpected duration ${route.durationMin} min`);
  assert.ok(route.steps.length >= 4, `expected turn-by-turn steps, got ${route.steps.length}`);
  assert.equal(route.steps[0].maneuver, 'depart');
  assert.equal(route.steps[route.steps.length - 1].maneuver, 'arrive');
});

test('computeDriverRouteProgress splits traveled vs remaining road geometry and computes heading', () => {
  const route = buildBaliFallbackRoute([PLACE_BY_ID.renon, PLACE_BY_ID.kampus_bukit]);
  const midPoint = route.coordinates[Math.floor(route.coordinates.length / 2)];
  const progress = computeDriverRouteProgress(route, midPoint);

  assert.ok(progress.progress > 0.35 && progress.progress < 0.65);
  assert.ok(progress.traveled.length >= 2);
  assert.ok(progress.remaining.length >= 2);
  assert.ok(progress.remainingKm < route.distanceKm);
  assert.ok(progress.heading >= 0 && progress.heading < 360);
  assert.ok(progress.activeStep !== null);
});

test('computeBearing and formatStepDistance return expected navigation values', () => {
  const east = computeBearing({ lat: -8.7, lng: 115.2 }, { lat: -8.7, lng: 115.3 });
  assert.ok(Math.abs(east - 90) < 2, `expected ~90 deg east, got ${east}`);
  assert.equal(formatStepDistance(450), '450 m');
  assert.equal(formatStepDistance(1450), '1,5 km');
});
