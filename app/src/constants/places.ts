import type { Place } from '@kirimin/shared';

export interface BaliPlace extends Place {
  id: string;
  area: 'Denpasar' | 'Badung' | 'Bukit';
  address: string;
}

export const BALI_PLACES: BaliPlace[] = [
  {
    id: 'tukad_badung',
    label: 'Jl. Tukad Badung, Renon',
    area: 'Denpasar',
    lat: -8.6795,
    lng: 115.2275,
    address: 'Jl. Tukad Badung No. 12, Renon',
  },
  {
    id: 'renon',
    label: 'Renon, Denpasar',
    area: 'Denpasar',
    lat: -8.6726,
    lng: 115.2335,
    address: 'Lapangan Niti Mandala, Renon',
  },
  {
    id: 'panjer',
    label: 'Panjer, Denpasar',
    area: 'Denpasar',
    lat: -8.677,
    lng: 115.224,
    address: 'Jl. Tukad Yeh Aya, Panjer',
  },
  {
    id: 'sesetan',
    label: 'Sesetan, Denpasar',
    area: 'Denpasar',
    lat: -8.7005,
    lng: 115.219,
    address: 'Jl. Raya Sesetan, Denpasar Selatan',
  },
  {
    id: 'sanur',
    label: 'Sanur, Denpasar',
    area: 'Denpasar',
    lat: -8.6878,
    lng: 115.2617,
    address: 'Bypass Ngurah Rai, Sanur',
  },
  {
    id: 'dewa_ruci',
    label: 'Simpang Dewa Ruci',
    area: 'Badung',
    lat: -8.7287,
    lng: 115.1782,
    address: 'Simpang Siur / Dewa Ruci, Kuta',
  },
  {
    id: 'kuta',
    label: 'Kuta, Badung',
    area: 'Badung',
    lat: -8.723,
    lng: 115.169,
    address: 'Jl. Raya Kuta, Badung',
  },
  {
    id: 'bypass_nusa_dua',
    label: 'Bypass Nusa Dua',
    area: 'Bukit',
    lat: -8.7655,
    lng: 115.2195,
    address: 'Jl. Bypass Ngurah Rai, Benoa',
  },
  {
    id: 'jimbaran',
    label: 'Jimbaran, Kuta Selatan',
    area: 'Bukit',
    lat: -8.768,
    lng: 115.169,
    address: 'Jl. Raya Uluwatu, Jimbaran',
  },
  {
    id: 'kampus_bukit',
    label: 'Kampus Bukit Jimbaran',
    area: 'Bukit',
    lat: -8.7983,
    lng: 115.1716,
    address: 'Universitas Udayana, Bukit Jimbaran',
  },
  {
    id: 'gedung_ft',
    label: 'Gedung FT Kampus Bukit',
    area: 'Bukit',
    lat: -8.799,
    lng: 115.1735,
    address: 'Fakultas Teknik Unud, Bukit Jimbaran',
  },
  {
    id: 'nusa_dua',
    label: 'Nusa Dua',
    area: 'Bukit',
    lat: -8.8007,
    lng: 115.231,
    address: 'Kawasan ITDC, Nusa Dua',
  },
];

export const PLACE_BY_ID: Record<string, BaliPlace> = Object.fromEntries(
  BALI_PLACES.map((p) => [p.id, p]),
);

export function findPlaceByPreset(preset?: string | null): BaliPlace | undefined {
  if (!preset) return undefined;
  const q = preset.toLowerCase().trim();
  return BALI_PLACES.find(
    (p) =>
      p.id === q ||
      p.label.toLowerCase() === q ||
      p.label.toLowerCase().includes(q),
  );
}

/** Haversine distance in km (matches @kirimin/shared / Wisnu Geo.kt) */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

/** Nearest known Bali landmark for reverse-labeling custom map pins */
export function describeCoordinates(lat: number, lng: number): string {
  let nearest: BaliPlace | null = null;
  let minKm = Infinity;
  for (const p of BALI_PLACES) {
    const d = haversineKm({ lat, lng }, p);
    if (d < minKm) {
      minKm = d;
      nearest = p;
    }
  }
  if (nearest && minKm <= 0.35) {
    return nearest.label;
  }
  if (nearest && minKm <= 3.0) {
    return `Sekitar ${nearest.label.split(',')[0]} (${minKm.toFixed(1)} km)`;
  }
  return `Titik Peta (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

/** Interpolate a point t in [0..1] along a polyline */
export function interpolateAlongRoute(
  points: { lat: number; lng: number }[],
  t: number,
): { lat: number; lng: number } {
  if (points.length === 0) return { lat: -8.72, lng: 115.2 };
  if (points.length === 1) return points[0];
  const clamped = Math.max(0, Math.min(1, t));
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = haversineKm(points[i - 1], points[i]);
    segLengths.push(len);
    total += len;
  }
  if (total === 0) return points[0];
  let target = clamped * total;
  for (let i = 0; i < segLengths.length; i++) {
    if (target <= segLengths[i] || i === segLengths.length - 1) {
      const ratio = segLengths[i] === 0 ? 0 : target / segLengths[i];
      return {
        lat: points[i].lat + (points[i + 1].lat - points[i].lat) * ratio,
        lng: points[i].lng + (points[i + 1].lng - points[i].lng) * ratio,
      };
    }
    target -= segLengths[i];
  }
  return points[points.length - 1];
}
