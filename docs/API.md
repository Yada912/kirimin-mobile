# Kirimin API reference

Base URL: `http://<laptop-ip>:3000` (an `/api` prefix also works, e.g. `/api/orders`).
All bodies are JSON. Response types live in [`shared/src/api.ts`](../shared/src/api.ts), so the app can import them.

**Auth:** send `Authorization: Bearer <token>` (from register/login). Tokens last 30 days.
**Errors:** `{ "error": { "code": "bad_request" | "unauthorized" | "forbidden" | "not_found" | "conflict" | …, "message": "<Bahasa Indonesia, safe to show>", "details": { "field": "phone" } } }`
**Money** is integer Rupiah. **Times** are ISO-8601 UTC strings. **Places** are `{ label, address?, lat, lng }`.

The "Screen" column maps each endpoint to Hecate's wireframes in Figma.

## Account

| Method & path | Body | Returns | Screen |
|---|---|---|---|
| `POST /auth/register` | `{ name, phone, password, email?, role? }` | `{ token, user }` | O1 |
| `POST /auth/login` | `{ phone, password }` | `{ token, user }` | O1 |
| `GET /me` | | `Me` | O3, X4 |
| `PATCH /me` | `{ name?, email?, avatarUrl?, activeRole?: 'sender'\|'driver', vehicle?: { type, plate } }` | `Me` | O2 (switch role), ST2 |
| `GET /me/stats` | | driver earnings + sender totals | P10 (simplified) |
| `GET /users/:id` | | `PublicUser` | driver/sender cards |
| `POST /me/password` | `{ currentPassword, newPassword }` | `{ token, user }` | ST "Ubah kata sandi" |
| `POST /auth/logout-all` | | `{ ok }` | ST "Keluar dari semua perangkat" |
| `GET /me/settings` / `PATCH /me/settings` | `{ push: { orders?, chat?, trips?, promos? } }` | `UserSettings` | ST "Notifikasi" |
| `POST /me/verification` | `{ ktpPhotoUrl, selfiePhotoUrl }` | `Me` | X4 |
| `POST /me/delete` | `{ password }` | `{ ok }` | ST "Hapus akun" |
| `GET /me/places` | | `SavedPlace[]` | S2 / D1 "Alamat tersimpan" |
| `POST /me/places` | `{ kind?: home\|work\|campus\|other, label, address?, lat, lng }` | `SavedPlace` (201) | |
| `PATCH /me/places/:id`, `DELETE /me/places/:id` | any of the create fields | `SavedPlace` / `{ ok }` | |
| `POST /me/push-tokens` | `{ token: "ExponentPushToken[…]", platform? }` | `{ ok }` | after login |
| `POST /me/push-tokens/remove` | `{ token }` | `{ ok }` | on logout |

Phone numbers are normalised, so `+62 812…`, `62812…` and `0812…` are the same account.

**Sessions.** Changing the password or calling `logout-all` invalidates every older token (the app gets `401` and should go to O1). `POST /me/password` returns a fresh token for the current device. Deleted accounts also get `401`.

**Verification (X4).** Upload the KTP photo and a selfie with `POST /uploads`, then send both URLs. `Me.verificationStatus` is `none | pending | verified | rejected`. There is no admin panel yet, so with `AUTO_APPROVE_VERIFICATION=true` (the default) submissions are approved immediately. Set it to `false` to review them in the `users` table.

**Deleting an account** is refused (409) while any order is still unfinished. The user's published routes are cancelled. The account is anonymised rather than removed, so the other person's history still shows "Akun dihapus", and the phone number can register again.

## Sending (Kirim)

| Method & path | Body | Returns | Screen |
|---|---|---|---|
| `POST /matches/estimate` | `{ size, pickup:{lat,lng}, dropoff:{lat,lng} }` | `{ distanceKm, range:{min,max} }` | S2 "Estimasi" |
| `POST /matches/search` | `{ size, pickup, dropoff, deliverBy? }` | `{ direct: TripMatch[], detour: TripMatch[] }` | S3 |
| `POST /orders` | see below | `Order` (201) | S4, or S6 without `tripId` |
| `GET /orders?as=sender\|driver&scope=active\|history\|all` | | `Order[]` | O4 Aktivitas, D9 |
| `GET /orders/:id` | | `Order` (with `timeline`) | S5, S8 |
| `POST /orders/:id/request` | `{ tripId }` | `Order` | choose another driver after a decline |
| `POST /orders/:id/post-open` | | `Order` | S3 "Posting Permintaan Terbuka" |
| `POST /orders/:id/pay` | `{ method: 'cash'\|'qris'\|'ewallet'\|'bank_va' }` | `Order` | P1–P6 (**mocked**) |
| `POST /orders/:id/cancel` | `{ reason? }` | `Order` | S7 |

`POST /orders` body:

```json
{
  "category": "Dokumen",            // Dokumen | Makanan | Elektronik | Pakaian | Lainnya
  "size": "XS",                     // XS | S | M | L
  "weightClass": "lt1",             // lt1 | 1to3 | 3to5 | gt5
  "handling": ["keep_dry"],         // fragile | keep_dry | this_side_up
  "photoUrl": "/uploads/….jpg",     // from POST /uploads
  "notes": "",
  "pickup":  { "label": "Jl. Tukad Badung", "lat": -8.6795, "lng": 115.2275 },
  "dropoff": { "label": "Gedung FT", "lat": -8.799, "lng": 115.1735 },
  "recipient": { "name": "Dewa", "phone": "0812…" },
  "deliverBy": "2026-11-10T02:00:00Z", // "Harus tiba sebelum" (optional)
  "handoverMethod": "meet",          // meet | leave_at_location (needs a photo at delivery)
  "paymentMethod": "cash",
  "tripId": "…"                      // omit → open request
}
```

Only the **sender** gets `handoverCode` (the 4 digits shown on S5). They pass it to the recipient, and the driver types it in at drop-off.

## Driving (Angkut)

| Method & path | Body | Returns | Screen |
|---|---|---|---|
| `POST /trips` | see below | `Trip` (201) | D1–D2 "Publikasikan Rute" |
| `GET /trips/mine?scope=active\|history` | | `Trip[]` | D6 |
| `GET /trips/:id` | | `Trip` | |
| `PATCH /trips/:id` | any of the create fields (not origin/destination) | `Trip` | D7 |
| `GET /trips/:id/requests` | | `IncomingRequest[]` (requested first, then open requests that fit) | D3 |
| `POST /orders/:id/accept` | `{ tripId? }` (required for open requests) | `Order` | D4 "Terima" |
| `POST /orders/:id/decline` | `{ reason? }` | `Order` | D4 "Tolak" |
| `POST /orders/:id/withdraw` | `{ reason? }` | `Order` | drop one package before pickup |
| `POST /trips/:id/start` | | `Trip` | D5 |
| `GET /trips/:id/manifest` | | `{ trip, stops[], orders[] }` | D5 "Urutan berhenti" |
| `POST /trips/:id/location` | `{ lat, lng }` | `{ ok }` | live map on S5 (send every ~10 s) |
| `POST /orders/:id/pickup` | `{ photoUrl? }` | `Order` | X2 at pickup |
| `POST /orders/:id/arrive` | | `Order` | "Tiba" |
| `POST /orders/:id/deliver` | `{ code, photoUrl? }` | `Order` | X2 |
| `POST /trips/:id/complete` | | `Trip` | |
| `POST /trips/:id/cancel` | `{ reason?, scope?: 'this'\|'series' }` | `Trip` | D8 |

`POST /trips` body (only `name`, `origin`, `destination` and `departAt` are required):

```json
{
  "name": "Ke Kampus",
  "origin": { "label": "Renon", "lat": -8.6726, "lng": 115.2335 },
  "stops": [{ "label": "Sesetan", "lat": -8.7005, "lng": 115.219 }],
  "destination": { "label": "Kampus Bukit", "lat": -8.7983, "lng": 115.1716 },
  "departAt": "2026-11-10T00:00:00Z",
  "arriveAt": "2026-11-10T00:45:00Z",   // optional, estimated if omitted
  "repeatDays": [1, 2, 3, 4, 5],          // 0 = Minggu … 6 = Sabtu; [] = one-off
  "vehicle": { "type": "motor", "plate": "DK 1101 XL" }, // optional once saved on the profile
  "acceptedSizes": ["XS", "S"],
  "maxPackages": 3,
  "maxWeightKg": 5,
  "maxDetourKm": 2,                       // "Simpangan maks. dari rute"
  "priceBand": null                       // null = "Harga otomatis", or { "min": 6000, "max": 12000 }
}
```

### Recurring routes

A trip with `repeatDays` is a weekly route. The server publishes each departure as its own `Trip` (same local time, same settings) for the next `RECURRING_HORIZON_DAYS` days (default 2). It does this when the route is created, at start-up, and every hour. All departures share `seriesId`, so the app can group them on D6. Weekdays use the `TZ_OFFSET_MINUTES` time zone (default WITA, UTC+8).

- `PATCH /trips/:id` with `"scope": "series"` also applies `name`, `acceptedSizes`, `maxPackages`, `maxWeightKg`, `maxDetourKm` and `priceBand` to every upcoming departure. Times and stops always apply to the one departure only. Changing `repeatDays` always changes the whole route.
- `POST /trips/:id/cancel` with `"scope": "series"` cancels this and every upcoming departure and stops the schedule. A departure that is already carrying packages is left running so the driver can finish it.

## Shared

| Method & path | Body | Returns | Screen |
|---|---|---|---|
| `GET /orders/:id/messages?after=<iso>` | | `ChatMessage[]` | X1 |
| `POST /orders/:id/messages` | `{ body }` | `ChatMessage` | X1 |
| `POST /orders/:id/messages/read` | | `{ ok }` | X1 |
| `POST /orders/:id/rating` | `{ stars: 1-5, tags?, comment? }` | `Rating` | X3 |
| `GET /orders/:id/ratings` | | `Rating[]` | |
| `GET /notifications` | | `{ items, unreadCount }` | O5 |
| `POST /notifications/:id/read`, `POST /notifications/read-all` | | `{ ok }` | O5 |
| `POST /orders/:id/reports` | `{ category, description (≥ 10 chars), photoUrl? }` | `Report` (201) | S9 / D10 "Laporkan masalah" |
| `GET /orders/:id/reports`, `GET /me/reports` | | `Report[]` (your own) | |
| `POST /uploads` | **raw image bytes**, `Content-Type: image/jpeg\|png\|webp` (≤ 5 MB) | `{ url }` (201) | S1, X2 |
| `GET /uploads/:name` | | the image | |
| `GET /meta` | | sizes, categories, labels, pricing rules | pickers |
| `GET /health` | | `{ ok }` | |

Upload from Expo: `FileSystem.uploadAsync(api + '/uploads', uri, { httpMethod: 'POST', uploadType: FileSystemUploadType.BINARY_CONTENT, headers: { Authorization, 'Content-Type': 'image/jpeg' } })`.
Uploaded URLs are relative (`/uploads/…`), so prefix them with the API base URL when displaying.

Report categories: `damaged`, `lost`, `late`, `wrong_item`, `payment`, `behaviour`, `safety`, `other` (labels in `/meta`). Reports are stored for follow-up in the `reports` table (no admin panel yet). Only the sender and driver of the order may report, and the other party isn't notified.

## Wallet (driver earnings, P10–P12)

| Method & path | Body | Returns | Screen |
|---|---|---|---|
| `GET /wallet` | | `WalletSummary` (`balance`, `cashCollected`, `totalEarned`, `earnedLast7Days`, `totalWithdrawn`, `entries[]`) | P10 |
| `POST /wallet/withdraw` | `{ amount, method: 'bank'\|'ewallet', provider, accountNumber, accountName }` | `WalletEntry` (201) | P11–P12 (**mocked**, completes instantly) |

How money gets booked:

- **QRIS / e-wallet / VA order delivered:** the driver's fee is added to `balance` and can be withdrawn.
- **Cash order delivered:** the driver already has the money, so it's recorded as `cash_earning`. It counts in `cashCollected` and `totalEarned`, not in `balance`.
- **Paid order cancelled after the driver accepted:** the driver gets the Rp 2.000 `compensation`, and the sender is refunded the rest.
- **Withdrawal:** `amount` from Rp 10.000 to Rp 5.000.000. `provider` must be one of `/meta → payout.providers[method]`.

## Push notifications

Register the device after login, and remove the token on logout:

```ts
import * as Notifications from 'expo-notifications';
const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
await api.post('/me/push-tokens', { token, platform: Platform.OS });
```

Every in-app notification (O5) is also sent as a push, and so is every chat message (to the other person). Each push carries `data.type` (e.g. `order.accepted`, `chat.message`) and `data.orderId`, so a tap can open the right screen. Users can mute channels in `PATCH /me/settings`: `orders`, `chat`, `trips` (incoming requests for drivers) and `promos`. Push needs a development build or an EAS build with FCM set up; Expo Go on Android no longer receives remote push. Set `PUSH_ENABLED=false` to turn sending off.

## Realtime

`GET /events?token=<token>` is a Server-Sent Events stream. Events (`shared/src/api.ts → RealtimeEvent`):

| event | when |
|---|---|
| `order.updated` | any status/payment change; payload is the full `Order` as that user may see it |
| `message.created` | new chat message |
| `notification.created` | new in-app notification |
| `trip.location` | driver GPS update for a trip carrying your package |

In React Native use the `react-native-sse` package. If the stream drops (or the tunnel doesn't support SSE), poll `GET /orders/:id` every few seconds; the API is the source of truth either way.

## Order lifecycle

```
open ──driver accepts──▶ accepted ─▶ picked_up ─▶ in_transit ─▶ arrived ─▶ delivered
  │  ▲                       │  (trip started)                     (code ✓)
  ▼  │ sender               ▼ sender cancels (refund − Rp 2.000)
requested ──driver declines──▶ declined ──▶ requested / open
  (cancel any time before pickup; open/requested expire at deliverBy)
```

The full rule table is in [`shared/src/orderFlow.ts`](../shared/src/orderFlow.ts). Pricing rules are in [`shared/src/pricing.ts`](../shared/src/pricing.ts), and route matching is in [`shared/src/matching.ts`](../shared/src/matching.ts).
