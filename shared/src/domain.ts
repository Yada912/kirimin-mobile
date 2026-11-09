/**
 * Kirimin domain vocabulary, shared by the server and the mobile app.
 *
 * Keep this file free of runtime dependencies so it can be imported from
 * Node (server), React Native (app) and tests alike.
 * Labels are Bahasa Indonesia because they are shown to users as-is.
 */

// ─── Geography ──────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

/** A named point on the map: a pickup, a drop-off, or a stop on a driver's route. */
export interface Place extends LatLng {
  label: string;
  address?: string;
}

// ─── Users ──────────────────────────────────────────────────────────────────

/** "Kirim" = sender mode, "Angkut" = driver mode. A user can switch any time (O2). */
export const ROLES = ['sender', 'driver'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  sender: 'Kirim',
  driver: 'Angkut',
};

// ─── Packages ───────────────────────────────────────────────────────────────

export const PACKAGE_SIZES = ['XS', 'S', 'M', 'L'] as const;
export type PackageSize = (typeof PACKAGE_SIZES)[number];

export const PACKAGE_SIZE_INFO: Record<PackageSize, { label: string; hint: string }> = {
  XS: { label: 'XS', hint: 'Amplop' },
  S: { label: 'S', hint: 'Kotak kecil' },
  M: { label: 'M', hint: 'Tas' },
  L: { label: 'L', hint: 'Besar' },
};

/** Returns true if `size` fits into a slot that accepts up to `max`. */
export function sizeFits(size: PackageSize, max: PackageSize): boolean {
  return PACKAGE_SIZES.indexOf(size) <= PACKAGE_SIZES.indexOf(max);
}

export const WEIGHT_CLASSES = ['lt1', '1to3', '3to5', 'gt5'] as const;
export type WeightClass = (typeof WEIGHT_CLASSES)[number];

export const WEIGHT_LABELS: Record<WeightClass, string> = {
  lt1: '< 1 kg',
  '1to3': '1–3 kg',
  '3to5': '3–5 kg',
  gt5: '> 5 kg',
};

export const CATEGORIES = ['Dokumen', 'Makanan', 'Elektronik', 'Pakaian', 'Lainnya'] as const;
export type Category = (typeof CATEGORIES)[number];

export const HANDLING_FLAGS = ['fragile', 'keep_dry', 'this_side_up'] as const;
export type HandlingFlag = (typeof HANDLING_FLAGS)[number];

export const HANDLING_LABELS: Record<HandlingFlag, string> = {
  fragile: 'Mudah pecah',
  keep_dry: 'Jaga dari air',
  this_side_up: 'Jangan dibalik',
};

/** How the package changes hands at drop-off (S2 "Serah terima"). */
export const HANDOVER_METHODS = ['meet', 'leave_at_location'] as const;
export type HandoverMethod = (typeof HANDOVER_METHODS)[number];

export const HANDOVER_LABELS: Record<HandoverMethod, string> = {
  meet: 'Bertemu driver',
  leave_at_location: 'Titip di lokasi',
};

// ─── Vehicles ───────────────────────────────────────────────────────────────

export const VEHICLE_TYPES = ['motor', 'mobil', 'bus'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  motor: 'Motor',
  mobil: 'Mobil',
  bus: 'Bus/Angkot',
};

/** Average urban speed used for ETAs until real routing (OSRM) is wired in. */
export const VEHICLE_SPEED_KMH: Record<VehicleType, number> = {
  motor: 28,
  mobil: 22,
  bus: 18,
};

// ─── Trips (a driver's published route, D1–D2) ─────────────────────────────

export const TRIP_STATUSES = ['published', 'ongoing', 'completed', 'cancelled'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  published: 'Terjadwal',
  ongoing: 'Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

// ─── Orders (a package being sent, S1–S9) ──────────────────────────────────

export const ORDER_STATUSES = [
  'open', //        posted, no driver yet (S6)
  'requested', //   sent to one driver's trip, waiting for them (S4 → D3)
  'declined', //    that driver said no; sender can pick another or post open
  'accepted', //    "Diterima"
  'picked_up', //   "Dijemput"
  'in_transit', //  "Jalan"
  'arrived', //     "Tiba"
  'delivered', //   "Selesai" (handover code confirmed, X2)
  'cancelled',
  'expired', //     deadline passed with no driver
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  open: 'Menunggu driver',
  requested: 'Menunggu konfirmasi driver',
  declined: 'Ditolak driver',
  accepted: 'Diterima',
  picked_up: 'Dijemput',
  in_transit: 'Dalam perjalanan',
  arrived: 'Tiba',
  delivered: 'Selesai',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
};

/** The 5-step tracker shown on S5 (Diterima → Dijemput → Jalan → Tiba → Selesai). */
export const TRACKING_STEPS: OrderStatus[] = ['accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'];

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['accepted', 'picked_up', 'in_transit', 'arrived'];
export const FINAL_ORDER_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'expired'];

// ─── Payments (mocked for the MVP) ─────────────────────────────────────────

export const PAYMENT_METHODS = ['cash', 'qris', 'ewallet', 'bank_va'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'partially_refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ─── Account (O1, X4, ST) ───────────────────────────────────────────────────

/** KTP verification (X4). Only `verified` shows the "KTP terverifikasi" badge. */
export const VERIFICATION_STATUSES = ['none', 'pending', 'verified', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  none: 'Belum verifikasi',
  pending: 'Sedang diperiksa',
  verified: 'KTP terverifikasi',
  rejected: 'Verifikasi ditolak',
};

/** "Alamat tersimpan" icons. */
export const SAVED_PLACE_KINDS = ['home', 'work', 'campus', 'other'] as const;
export type SavedPlaceKind = (typeof SAVED_PLACE_KINDS)[number];

export const SAVED_PLACE_LABELS: Record<SavedPlaceKind, string> = {
  home: 'Rumah',
  work: 'Kantor',
  campus: 'Kampus',
  other: 'Lainnya',
};

/** Which push notifications a user wants (ST "Notifikasi"). In-app notifications are always kept. */
export const NOTIFICATION_CHANNELS = ['orders', 'chat', 'trips', 'promos'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  orders: 'Status pesanan',
  chat: 'Pesan chat',
  trips: 'Rute & permintaan titipan',
  promos: 'Promo & info',
};

// ─── Problem reports (S9 / D10) ─────────────────────────────────────────────

export const REPORT_CATEGORIES = ['damaged', 'lost', 'late', 'wrong_item', 'payment', 'behaviour', 'safety', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  damaged: 'Paket rusak',
  lost: 'Paket hilang',
  late: 'Terlambat',
  wrong_item: 'Isi paket tidak sesuai',
  payment: 'Masalah pembayaran',
  behaviour: 'Perilaku pengguna',
  safety: 'Keamanan',
  other: 'Lainnya',
};

export const REPORT_STATUSES = ['open', 'in_review', 'resolved'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

// ─── Driver wallet (P10–P12, mocked payouts) ───────────────────────────────

export const WALLET_ENTRY_TYPES = ['earning', 'cash_earning', 'compensation', 'withdrawal'] as const;
export type WalletEntryType = (typeof WALLET_ENTRY_TYPES)[number];

export const WALLET_ENTRY_LABELS: Record<WalletEntryType, string> = {
  earning: 'Pendapatan titipan',
  cash_earning: 'Pendapatan tunai',
  compensation: 'Kompensasi pembatalan',
  withdrawal: 'Tarik saldo',
};

export const PAYOUT_METHODS = ['bank', 'ewallet'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_PROVIDERS: Record<PayoutMethod, string[]> = {
  bank: ['BCA', 'BRI', 'BNI', 'Mandiri', 'BPD Bali', 'BSI'],
  ewallet: ['GoPay', 'OVO', 'DANA', 'ShopeePay'],
};

export const WITHDRAWAL_RULES = { min: 10_000, max: 5_000_000 };
