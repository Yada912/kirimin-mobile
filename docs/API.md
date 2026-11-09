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

Phone numbers are normalised, so `+62 812…`, `62812…` and `0812…` are the same account.

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
| `POST /trips/:id/cancel` | `{ reason? }` | `Trip` | D8 |

`POST /trips` body (only `name`, `origin`, `destination` and `departAt` are required):

```json
{
  "name": "Ke Kampus",
  "origin": { "label": "Renon", "lat": -8.6726, "lng": 115.2335 },
  "stops": [{ "label": "Sesetan", "lat": -8.7005, "lng": 115.219 }],
  "destination": { "label": "Kampus Bukit", "lat": -8.7983, "lng": 115.1716 },
  "departAt": "2026-11-10T00:00:00Z",
  "arriveAt": "2026-11-10T00:45:00Z",   // optional, estimated if omitted
  "repeatDays": [1, 2, 3, 4, 5],          // 0 = Minggu … 6 = Sabtu (stored; recurring trips come later)
  "vehicle": { "type": "motor", "plate": "DK 1101 XL" }, // optional once saved on the profile
  "acceptedSizes": ["XS", "S"],
  "maxPackages": 3,
  "maxWeightKg": 5,
  "maxDetourKm": 2,                       // "Simpangan maks. dari rute"
  "priceBand": null                       // null = "Harga otomatis", or { "min": 6000, "max": 12000 }
}
```

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
| `POST /uploads` | **raw image bytes**, `Content-Type: image/jpeg\|png\|webp` (≤ 5 MB) | `{ url }` (201) | S1, X2 |
| `GET /uploads/:name` | | the image | |
| `GET /meta` | | sizes, categories, labels, pricing rules | pickers |
| `GET /health` | | `{ ok }` | |

Upload from Expo: `FileSystem.uploadAsync(api + '/uploads', uri, { httpMethod: 'POST', uploadType: FileSystemUploadType.BINARY_CONTENT, headers: { Authorization, 'Content-Type': 'image/jpeg' } })`.
Uploaded URLs are relative (`/uploads/…`), so prefix them with the API base URL when displaying.

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
