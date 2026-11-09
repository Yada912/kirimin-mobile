/** Unit tests for the formatting helpers every screen uses. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDetour, formatDistance, formatRupiah, formatSimilarity, formatTime } from '../../src/utils/format.ts';

test('formatRupiah uses Indonesian thousands separators', () => {
  assert.equal(formatRupiah(12000), 'Rp 12.000');
  assert.equal(formatRupiah(5000.4), 'Rp 5.000');
  assert.equal(formatRupiah(null), 'Rp 0');
});

test('formatDistance switches to metres under 1 km and uses a decimal comma', () => {
  assert.equal(formatDistance(0.45), '450 m');
  assert.equal(formatDistance(1.25), '1,3 km');
  assert.equal(formatDetour(1.2, 6), '+1,2 km (~6 mnt)');
});

test('formatSimilarity treats the API value as a percentage (94 → "94%", never "9400%")', () => {
  assert.equal(formatSimilarity(94), '94%');
  assert.equal(formatSimilarity(100), '100%');
  assert.equal(formatSimilarity(250), '100%');
  assert.equal(formatSimilarity(undefined), '0%');
});

test('formatTime renders a 24-hour clock and survives bad input', () => {
  assert.match(formatTime('2026-11-10T00:40:00Z'), /^\d{2}[.:]\d{2}$/);
  assert.equal(formatTime('not a date'), '-');
  assert.equal(formatTime(null), '-');
});
