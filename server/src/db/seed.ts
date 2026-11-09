import type { Place } from '../../../shared/src/index.ts';
import type { Db } from './database.ts';
import { hashPassword } from '../auth/tokens.ts';
import { addMinutes, handoverCode, newId, nowIso, orderCode } from '../lib/util.ts';

/**
 * Demo data around Denpasar ↔ Kampus Udayana Bukit Jimbaran, matching the Figma
 * wireframes. Every demo account uses the password `kirimin123`.
 *
 * Trip times are relative to "now" so the demo always has trips departing soon.
 * Run `npm run db:reset` to wipe and reseed when they get stale.
 */
const P = (label: string, lat: number, lng: number, address?: string): Place => ({ label, lat, lng, ...(address ? { address } : {}) });

export const PLACES = {
  renon: P('Renon', -8.6726, 115.2335, 'Lapangan Niti Mandala, Renon'),
  tukadBadung: P('Jl. Tukad Badung', -8.6795, 115.2275, 'Jl. Tukad Badung No. 12, Renon'),
  panjer: P('Panjer', -8.677, 115.224),
  sesetan: P('Sesetan', -8.7005, 115.219),
  dewaRuci: P('Simpang Dewa Ruci', -8.7287, 115.1782),
  jimbaran: P('Jimbaran', -8.768, 115.169),
  kampusBukit: P('Kampus Bukit Jimbaran', -8.7983, 115.1716, 'Universitas Udayana, Bukit Jimbaran'),
  gedungFT: P('Gedung FT', -8.799, 115.1735, 'Fakultas Teknik Unud, Bukit Jimbaran'),
  sanur: P('Sanur', -8.6878, 115.2617),
  bypassNusaDua: P('Bypass Nusa Dua', -8.7655, 115.2195),
  nusaDua: P('Nusa Dua', -8.8007, 115.231),
};

export const DEMO_PASSWORD = 'kirimin123';

export const DEMO_USERS = {
  wayan: { name: 'Wayan', phone: '081200000001', role: 'sender' },
  ayu: { name: 'Ayu P.', phone: '081200000002', role: 'sender' },
  made: { name: 'Made S.', phone: '081200000003', role: 'driver', vehicle: ['motor', 'DK 1101 XL'] },
  komang: { name: 'Komang A.', phone: '081200000004', role: 'driver', vehicle: ['motor', 'DK 2290 AB'] },
  putu: { name: 'Putu W.', phone: '081200000005', role: 'driver', vehicle: ['mobil', 'DK 1888 CD'] },
} as const;

export async function seedIfEmpty(db: Db): Promise<boolean> {
  const any = await db.get('SELECT 1 FROM users LIMIT 1');
  if (any) return false;
  await seed(db);
  return true;
}

export async function seed(db: Db) {
  const now = nowIso();
  const hash = await hashPassword(DEMO_PASSWORD);
  const ids: Record<keyof typeof DEMO_USERS, string> = { wayan: '', ayu: '', made: '', komang: '', putu: '' };
  const stats: Record<keyof typeof DEMO_USERS, [number, number, number, number]> = {
    // rating_sum, rating_count, deliveries, sends
    wayan: [0, 0, 0, 4],
    ayu: [113, 23, 0, 23],
    made: [576, 120, 120, 2],
    komang: [96, 20, 20, 0],
    putu: [147, 30, 30, 1],
  };

  await db.transaction(async (tx) => {
    for (const key of Object.keys(DEMO_USERS) as (keyof typeof DEMO_USERS)[]) {
      const u = DEMO_USERS[key];
      const id = newId();
      ids[key] = id;
      const vehicle = 'vehicle' in u ? u.vehicle : null;
      const [rs, rc, dc, sc] = stats[key];
      await tx.run(
        `INSERT INTO users (id, name, phone, email, password_hash, avatar_url, active_role, verified, verification_status,
           vehicle_type, vehicle_plate, rating_sum, rating_count, deliveries_count, sends_count, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, NULL, ?, 1, 'verified', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, u.name, u.phone, hash, u.role, vehicle?.[0] ?? null, vehicle?.[1] ?? null, rs, rc, dc, sc, now, now],
      );
    }

    const trip = async (
      driver: keyof typeof DEMO_USERS,
      name: string,
      origin: Place,
      stops: Place[],
      dest: Place,
      departInMin: number,
      durationMin: number,
      sizes: string[],
      maxPackages: number,
      maxDetourKm: number,
    ) => {
      const u = DEMO_USERS[driver];
      const vehicle = 'vehicle' in u ? u.vehicle : ['motor', '-'];
      const depart = addMinutes(now, departInMin);
      const id = newId();
      await tx.run(
        `INSERT INTO trips (id, series_id, driver_id, name, origin_json, stops_json, destination_json, depart_at, arrive_at, repeat_days_json,
           vehicle_type, vehicle_plate, accepted_sizes_json, max_packages, max_weight_kg, max_detour_km, price_min, price_max,
           status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, 'published', ?, ?)`,
        [id, id, ids[driver], name, JSON.stringify(origin), JSON.stringify(stops), JSON.stringify(dest), depart,
          addMinutes(depart, durationMin), JSON.stringify([1, 2, 3, 4, 5]), vehicle[0], vehicle[1], JSON.stringify(sizes),
          maxPackages, maxDetourKm, now, now],
      );
    };

    await trip('made', 'Ke Kampus', PLACES.renon, [PLACES.sesetan, PLACES.dewaRuci], PLACES.kampusBukit, 60, 45, ['XS', 'S', 'M'], 3, 2);
    await trip('komang', 'Ke Kampus', PLACES.panjer, [PLACES.dewaRuci, PLACES.jimbaran], PLACES.kampusBukit, 75, 40, ['XS', 'S'], 2, 1.5);
    await trip('putu', 'Ke Nusa Dua', PLACES.sanur, [PLACES.bypassNusaDua], PLACES.nusaDua, 90, 35, ['XS', 'S', 'M', 'L'], 5, 3);

    // One open request from Ayu, so a driver's inbox (D3) isn't empty.
    const orderId = newId();
    await tx.run(
      `INSERT INTO orders (id, code, sender_id, status, category, size, weight_class, handling_json, notes, pickup_json, dropoff_json,
         recipient_name, recipient_phone, deliver_by, handover_method, payment_method, payment_status, handover_code, created_at, updated_at)
       VALUES (?, ?, ?, 'open', 'Dokumen', 'XS', 'lt1', '["keep_dry"]', 'Map berisi berkas KRS', ?, ?, 'Dewa', '081299990000', ?, 'meet', 'cash', 'unpaid', ?, ?, ?)`,
      [orderId, orderCode(), ids.ayu, JSON.stringify(PLACES.tukadBadung), JSON.stringify(PLACES.gedungFT), addMinutes(now, 240), handoverCode(), now, now],
    );
    await tx.run(`INSERT INTO order_events (id, order_id, status, actor_id, note, created_at) VALUES (?, ?, 'open', ?, NULL, ?)`, [
      newId(), orderId, ids.ayu, now,
    ]);
  });
}
