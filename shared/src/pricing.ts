import type { PackageSize } from './domain.ts';
import { ROAD_FACTOR } from './geo.ts';

/**
 * Pricing rules for the MVP. Everything is in Rupiah (integers).
 * Tweak the numbers here; server and app both read from this module so the
 * estimate shown on S2 always agrees with what the server charges on S4.
 */
export const PRICING = {
  baseBySize: { XS: 4000, S: 5000, M: 6500, L: 8000 } satisfies Record<PackageSize, number>,
  perKm: 250, //          per road-km between pickup and drop-off
  perDetourKm: 1500, //   per extra km the driver must travel
  min: 5000,
  max: 25000,
  roundTo: 500,
  serviceFee: 1000, //    "Biaya layanan" shown on S4
  /** Kept by the driver if the sender cancels after the driver accepted (S7). */
  lateCancelCompensation: 2000,
};

export interface PriceRange {
  min: number;
  max: number;
}

export interface PriceInput {
  size: PackageSize;
  /** Straight-line km between pickup and drop-off. */
  packageKm: number;
  detourKm: number;
  /** A driver may set their own band on D2 ("Atur manual"). */
  driverBand?: PriceRange | null;
}

export interface PriceQuote {
  fee: number; //        "Ongkos titip" → goes to the driver
  serviceFee: number; // "Biaya layanan" → goes to the platform
  total: number;
}

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function quote({ size, packageKm, detourKm, driverBand }: PriceInput): PriceQuote {
  const raw =
    PRICING.baseBySize[size] + packageKm * ROAD_FACTOR * PRICING.perKm + detourKm * ROAD_FACTOR * PRICING.perDetourKm;
  const lo = driverBand?.min ?? PRICING.min;
  const hi = driverBand?.max ?? PRICING.max;
  const fee = clamp(roundUp(raw, PRICING.roundTo), lo, hi);
  return { fee, serviceFee: PRICING.serviceFee, total: fee + PRICING.serviceFee };
}

/** The "Estimasi Rp 5.000 – 12.000" range on S2, before a driver is chosen. */
export function estimateRange(size: PackageSize, packageKm: number, maxDetourKm = 2): PriceRange {
  return {
    min: quote({ size, packageKm, detourKm: 0 }).fee,
    max: quote({ size, packageKm, detourKm: maxDetourKm }).fee,
  };
}

/** How much the sender gets back when cancelling (S7). */
export function refundFor(total: number, driverHadAccepted: boolean): { refund: number; compensation: number } {
  if (!driverHadAccepted) return { refund: total, compensation: 0 };
  const compensation = Math.min(PRICING.lateCancelCompensation, total);
  return { refund: total - compensation, compensation };
}
