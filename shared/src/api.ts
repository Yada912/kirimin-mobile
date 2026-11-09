/**
 * Shapes of the JSON the API returns. The mobile app imports these so that a
 * change on the server shows up as a type error in the app instead of a crash.
 * All timestamps are ISO-8601 strings in UTC; all money is integer Rupiah.
 */
import type {
  Category,
  HandlingFlag,
  HandoverMethod,
  OrderStatus,
  PackageSize,
  PaymentMethod,
  PaymentStatus,
  NotificationChannel,
  PayoutMethod,
  Place,
  ReportCategory,
  ReportStatus,
  Role,
  SavedPlaceKind,
  TripStatus,
  VehicleType,
  VerificationStatus,
  WalletEntryType,
  WeightClass,
} from './domain.ts';
import type { MatchKind } from './matching.ts';

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface Vehicle {
  type: VehicleType;
  plate: string;
}

/** What anyone may see about another user (driver card on S3/S4, sender card on D4). */
export interface PublicUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  deliveriesCount: number; // as driver
  sendsCount: number; //      as sender
  verified: boolean; //       "KTP terverifikasi"
  vehicle: Vehicle | null;
}

/** Per-user preferences (ST screens). */
export interface UserSettings {
  /** Push notifications per channel; in-app notifications (O5) are always stored. */
  push: Record<NotificationChannel, boolean>;
}

/** The signed-in user (GET /me). */
export interface Me extends PublicUser {
  phone: string;
  email: string | null;
  activeRole: Role;
  verificationStatus: VerificationStatus;
  /** Reason shown when verification was rejected. */
  verificationNote: string | null;
  settings: UserSettings;
  createdAt: string;
}

/** "Alamat tersimpan". */
export interface SavedPlace extends Place {
  id: string;
  kind: SavedPlaceKind;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: Me;
}

export interface PriceBand {
  min: number;
  max: number;
}

/** A driver's published route for one departure (D1–D2, D6). */
export interface Trip {
  id: string;
  driver: PublicUser;
  name: string; //               "Ke Kampus"
  origin: Place;
  stops: Place[];
  destination: Place;
  departAt: string;
  arriveAt: string;
  repeatDays: number[]; //       0 = Minggu … 6 = Sabtu; empty = one-off (D7)
  vehicle: Vehicle;
  acceptedSizes: PackageSize[];
  maxPackages: number;
  maxWeightKg: number | null;
  maxDetourKm: number;
  priceBand: PriceBand | null; // null = "Harga otomatis"
  status: TripStatus;
  /** Shared by every occurrence of a weekly schedule; equals `id` for one-off trips. */
  seriesId: string;
  slotsUsed: number;
  lastLocation: { lat: number; lng: number; at: string } | null;
  createdAt: string;
}

export interface OrderPrice {
  fee: number;
  serviceFee: number;
  total: number;
}

export interface Order {
  id: string;
  code: string; //               "TTP-7XK2"
  sender: PublicUser;
  driver: PublicUser | null;
  tripId: string | null;
  status: OrderStatus;

  category: Category;
  size: PackageSize;
  weightClass: WeightClass;
  handling: HandlingFlag[];
  photoUrl: string | null;
  notes: string;

  pickup: Place;
  dropoff: Place;
  recipient: { name: string; phone: string };
  deliverBy: string | null; //  "Harus tiba sebelum"
  handoverMethod: HandoverMethod;

  price: OrderPrice | null;
  detourKm: number | null;
  eta: { pickupAt: string | null; dropoffAt: string | null };

  payment: { method: PaymentMethod | null; status: PaymentStatus; refundAmount: number };
  /** Only returned to the sender: they pass it to the recipient, the driver enters it on X2. */
  handoverCode?: string;

  pickupPhotoUrl: string | null;
  deliveryPhotoUrl: string | null;
  cancelReason: string | null;
  timeline: { status: OrderStatus; at: string; note?: string }[];
  createdAt: string;
  updatedAt: string;
}

/** One row in "Driver searah" (S3) / one incoming request on D3. */
export interface TripMatch {
  trip: Trip;
  kind: MatchKind; //           "Langsung" or "Dengan simpangan"
  similarity: number; //        "94% kemiripan rute"
  detourKm: number;
  detourMinutes: number;
  price: OrderPrice;
  eta: { pickupAt: string; dropoffAt: string };
}

export interface IncomingRequest {
  order: Order;
  /** "requested" = sent to this trip; "open" = public request that fits this trip. */
  source: 'requested' | 'open';
  kind: MatchKind;
  similarity: number;
  detourKm: number;
  detourMinutes: number;
  /** "Kamu dapat Rp 12.000" — what the driver earns. */
  earning: number;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface Rating {
  id: string;
  orderId: string;
  fromUserId: string;
  toUserId: string;
  stars: number;
  tags: string[];
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

/** Server-sent events pushed on GET /events. */
export type RealtimeEvent =
  | { type: 'order.updated'; order: Order }
  | { type: 'message.created'; message: ChatMessage }
  | { type: 'notification.created'; notification: Notification }
  | { type: 'trip.location'; tripId: string; lat: number; lng: number; at: string };

/** S9 / D10 "Laporkan masalah". */
export interface Report {
  id: string;
  orderId: string;
  orderCode: string;
  reporterId: string;
  category: ReportCategory;
  description: string;
  photoUrl: string | null;
  status: ReportStatus;
  createdAt: string;
}

export interface WalletEntry {
  id: string;
  type: WalletEntryType;
  /** Signed: withdrawals are negative. */
  amount: number;
  status: 'completed' | 'processing' | 'failed';
  orderId: string | null;
  orderCode: string | null;
  note: string | null;
  payout: { method: PayoutMethod; provider: string; accountNumber: string; accountName: string } | null;
  createdAt: string;
}

/** GET /wallet (P10 "Pendapatan"). */
export interface WalletSummary {
  /** Withdrawable: non-cash earnings + compensation − withdrawals. */
  balance: number;
  /** Fees the driver already received in cash (not withdrawable). */
  cashCollected: number;
  totalEarned: number;
  earnedLast7Days: number;
  totalWithdrawn: number;
  entries: WalletEntry[];
}
