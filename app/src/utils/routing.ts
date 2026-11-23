import type { LatLng } from '@kirimin/shared';

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sLat = Math.sin(dLat / 2);
  const sLng = Math.sin(dLng / 2);
  const h = sLat * sLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sLng * sLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export type ManeuverType =
  | 'depart'
  | 'straight'
  | 'turn-left'
  | 'turn-right'
  | 'slight-left'
  | 'slight-right'
  | 'roundabout'
  | 'uturn'
  | 'arrive';

export interface RouteStep {
  id: string;
  instruction: string;
  roadName: string;
  maneuver: ManeuverType;
  distanceM: number;
  durationSec: number;
  location: LatLng;
}

export interface RoadRoute {
  coordinates: LatLng[];
  distanceKm: number;
  durationMin: number;
  steps: RouteStep[];
  source: 'osrm' | 'bali-road-graph';
}

// ─── South Bali Arterial Road Network (Fallback & Offline Routing) ───────────
// Real arterial intersections across Denpasar – Kuta – Jimbaran – Bukit – Nusa Dua
interface RoadNode {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

const BALI_ROAD_NODES: RoadNode[] = [
  { id: 'renon_niti', lat: -8.6726, lng: 115.2335, label: 'Jl. Raya Puputan Renon' },
  { id: 'tukad_badung', lat: -8.6795, lng: 115.2275, label: 'Jl. Tukad Badung' },
  { id: 'panjer_yeh_aya', lat: -8.6770, lng: 115.2240, label: 'Jl. Tukad Yeh Aya' },
  { id: 'sanur_bypass', lat: -8.6878, lng: 115.2617, label: 'Jl. Bypass Ngurah Rai Sanur' },
  { id: 'sanur_south', lat: -8.7042, lng: 115.2528, label: 'Jl. Bypass Ngurah Rai' },
  { id: 'sesetan_north', lat: -8.6895, lng: 115.2215, label: 'Jl. Raya Sesetan' },
  { id: 'sesetan_mid', lat: -8.7005, lng: 115.2190, label: 'Jl. Raya Sesetan' },
  { id: 'pesanggaran', lat: -8.7165, lng: 115.2145, label: 'Simpang Pesanggaran' },
  { id: 'benoa_gate', lat: -8.7248, lng: 115.2130, label: 'Simpang Pelabuhan Benoa' },
  { id: 'dewa_ruci', lat: -8.7287, lng: 115.1782, label: 'Bundaran Simpang Dewa Ruci' },
  { id: 'kuta_raya', lat: -8.7230, lng: 115.1690, label: 'Jl. Raya Kuta' },
  { id: 'tuban_bypass', lat: -8.7425, lng: 115.1775, label: 'Jl. Bypass Ngurah Rai Tuban' },
  { id: 'kedonganan', lat: -8.7568, lng: 115.1755, label: 'Jl. Bypass Ngurah Rai Kedonganan' },
  { id: 'jimbaran_jct', lat: -8.7680, lng: 115.1690, label: 'Jl. Raya Uluwatu Jimbaran' },
  { id: 'jimbaran_hill', lat: -8.7822, lng: 115.1684, label: 'Jl. Raya Uluwatu' },
  { id: 'unud_gate', lat: -8.7915, lng: 115.1704, label: 'Jl. Raya Kampus Unud' },
  { id: 'kampus_bukit', lat: -8.7983, lng: 115.1716, label: 'Kampus Unud Bukit Jimbaran' },
  { id: 'gedung_ft', lat: -8.7990, lng: 115.1735, label: 'Jl. Teknik Kampus Bukit' },
  { id: 'tol_nusa_dua', lat: -8.7655, lng: 115.2195, label: 'Jl. Bypass Nusa Dua' },
  { id: 'mumbul', lat: -8.7845, lng: 115.2152, label: 'Jl. Bypass Ngurah Rai Mumbul' },
  { id: 'nusa_dua_itdc', lat: -8.8007, lng: 115.2310, label: 'Kawasan ITDC Nusa Dua' },
  { id: 'unud_mumbul_link', lat: -8.7920, lng: 115.1935, label: 'Jl. Dharmawangsa' },
];

const BALI_ROAD_EDGES: [string, string, string][] = [
  ['renon_niti', 'tukad_badung', 'Jl. Tukad Badung'],
  ['renon_niti', 'panjer_yeh_aya', 'Jl. Tukad Yeh Aya'],
  ['renon_niti', 'sanur_bypass', 'Jl. Hang Tuah'],
  ['tukad_badung', 'panjer_yeh_aya', 'Jl. Tukad Yeh Aya'],
  ['tukad_badung', 'sesetan_north', 'Jl. Tukad Badung'],
  ['panjer_yeh_aya', 'sesetan_north', 'Jl. Waturenggong'],
  ['sesetan_north', 'sesetan_mid', 'Jl. Raya Sesetan'],
  ['sesetan_mid', 'pesanggaran', 'Jl. Raya Sesetan'],
  ['sanur_bypass', 'sanur_south', 'Jl. Bypass Ngurah Rai'],
  ['sanur_south', 'pesanggaran', 'Jl. Bypass Ngurah Rai'],
  ['pesanggaran', 'benoa_gate', 'Jl. Bypass Ngurah Rai'],
  ['pesanggaran', 'dewa_ruci', 'Jl. Bypass Ngurah Rai'],
  ['benoa_gate', 'dewa_ruci', 'Jl. Bypass Ngurah Rai'],
  ['benoa_gate', 'tol_nusa_dua', 'Tol Bali Mandara'],
  ['dewa_ruci', 'kuta_raya', 'Jl. Raya Kuta'],
  ['dewa_ruci', 'tuban_bypass', 'Jl. Bypass Ngurah Rai'],
  ['kuta_raya', 'tuban_bypass', 'Jl. Raya Tuban'],
  ['tuban_bypass', 'kedonganan', 'Jl. Bypass Ngurah Rai'],
  ['kedonganan', 'jimbaran_jct', 'Jl. Bypass Ngurah Rai'],
  ['kedonganan', 'tol_nusa_dua', 'Jl. Bypass Ngurah Rai'],
  ['jimbaran_jct', 'jimbaran_hill', 'Jl. Raya Uluwatu'],
  ['jimbaran_hill', 'unud_gate', 'Jl. Raya Kampus Unud'],
  ['unud_gate', 'kampus_bukit', 'Jl. Raya Kampus Unud'],
  ['kampus_bukit', 'gedung_ft', 'Jl. Teknik Kampus Bukit'],
  ['unud_gate', 'unud_mumbul_link', 'Jl. Raya Kampus Unud'],
  ['unud_mumbul_link', 'mumbul', 'Jl. Dharmawangsa'],
  ['tol_nusa_dua', 'mumbul', 'Jl. Bypass Ngurah Rai'],
  ['mumbul', 'nusa_dua_itdc', 'Jl. Bypass Nusa Dua'],
];

const NODE_MAP = new Map<string, RoadNode>(BALI_ROAD_NODES.map((n) => [n.id, n]));
const ADJ = new Map<string, { to: string; road: string; dist: number }[]>();
for (const n of BALI_ROAD_NODES) ADJ.set(n.id, []);
for (const [a, b, road] of BALI_ROAD_EDGES) {
  const na = NODE_MAP.get(a)!;
  const nb = NODE_MAP.get(b)!;
  const dist = haversineKm(na, nb);
  ADJ.get(a)!.push({ to: b, road, dist });
  ADJ.get(b)!.push({ to: a, road, dist });
}

function nearestRoadNode(pt: LatLng): RoadNode {
  let best = BALI_ROAD_NODES[0];
  let bestD = Infinity;
  for (const n of BALI_ROAD_NODES) {
    const d = haversineKm(pt, n);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function shortestRoadPath(startId: string, endId: string): { nodes: RoadNode[]; roads: string[] } {
  if (startId === endId) return { nodes: [NODE_MAP.get(startId)!], roads: [] };
  const dist = new Map<string, number>();
  const prev = new Map<string, { id: string; road: string }>();
  const visited = new Set<string>();
  for (const n of BALI_ROAD_NODES) dist.set(n.id, Infinity);
  dist.set(startId, 0);

  while (visited.size < BALI_ROAD_NODES.length) {
    let curr: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist.entries()) {
      if (!visited.has(id) && d < best) {
        best = d;
        curr = id;
      }
    }
    if (!curr || curr === endId) break;
    visited.add(curr);

    for (const edge of ADJ.get(curr) || []) {
      const nd = best + edge.dist;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, { id: curr, road: edge.road });
      }
    }
  }

  const nodeIds: string[] = [];
  const roads: string[] = [];
  let cur: string | undefined = endId;
  while (cur) {
    nodeIds.unshift(cur);
    const p = prev.get(cur);
    if (p) roads.unshift(p.road);
    cur = p?.id;
  }
  return {
    nodes: nodeIds.map((id) => NODE_MAP.get(id)!),
    roads,
  };
}

/** Bearing in degrees [0..360), 0 = North, 90 = East */
export function computeBearing(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function classifyTurn(prevBearing: number, nextBearing: number): ManeuverType {
  let diff = ((nextBearing - prevBearing + 540) % 360) - 180; // [-180..180]
  if (Math.abs(diff) < 22) return 'straight';
  if (diff >= 22 && diff < 60) return 'slight-right';
  if (diff >= 60 && diff < 150) return 'turn-right';
  if (diff <= -22 && diff > -60) return 'slight-left';
  if (diff <= -60 && diff > -150) return 'turn-left';
  return 'uturn';
}

function formatManeuverId(maneuver: ManeuverType, roadName: string): string {
  const street = roadName || 'jalan utama';
  switch (maneuver) {
    case 'depart':
      return `Mulai perjalanan menuju ${street}`;
    case 'arrive':
      return `Tiba di titik tujuan (${street})`;
    case 'roundabout':
      return `Masuk bundaran, lanjut ke ${street}`;
    case 'turn-left':
      return `Belok kiri ke ${street}`;
    case 'turn-right':
      return `Belok kanan ke ${street}`;
    case 'slight-left':
      return `Ambil kiri menuju ${street}`;
    case 'slight-right':
      return `Ambil kanan menuju ${street}`;
    case 'uturn':
      return `Putar balik menuju ${street}`;
    default:
      return `Terus lurus di ${street}`;
  }
}

/** Subdivide polyline segments gently so driver animations stay silky smooth */
function densifyPolyline(pts: LatLng[], stepKm = 0.28): LatLng[] {
  if (pts.length < 2) return pts;
  const out: LatLng[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = haversineKm(a, b);
    const n = Math.max(1, Math.min(14, Math.ceil(d / stepKm)));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      });
    }
  }
  return out;
}

/** Build a realistic South Bali arterial road route without external network dependency */
export function buildBaliFallbackRoute(waypoints: LatLng[]): RoadRoute {
  if (waypoints.length < 2) {
    return {
      coordinates: waypoints,
      distanceKm: 0,
      durationMin: 0,
      steps: [],
      source: 'bali-road-graph',
    };
  }

  const rawCoords: LatLng[] = [waypoints[0]];
  const rawSteps: RouteStep[] = [];
  let totalKm = 0;

  for (let w = 0; w < waypoints.length - 1; w++) {
    const startPt = waypoints[w];
    const endPt = waypoints[w + 1];
    const startNode = nearestRoadNode(startPt);
    const endNode = nearestRoadNode(endPt);
    const { nodes, roads } = shortestRoadPath(startNode.id, endNode.id);

    const legPts: LatLng[] = [startPt, ...nodes.map((n) => ({ lat: n.lat, lng: n.lng })), endPt];
    // Remove adjacent near-duplicates (< 50m)
    const cleanLeg: LatLng[] = [];
    for (const p of legPts) {
      if (cleanLeg.length === 0 || haversineKm(cleanLeg[cleanLeg.length - 1], p) > 0.05) {
        cleanLeg.push(p);
      }
    }

    for (let i = 1; i < cleanLeg.length; i++) {
      const segKm = haversineKm(cleanLeg[i - 1], cleanLeg[i]);
      totalKm += segKm;
      rawCoords.push(cleanLeg[i]);
    }

    // Generate clean turn-by-turn steps from nodes & road labels
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const roadName = roads[i] || node.label;
      const nextPt = i + 1 < nodes.length ? nodes[i + 1] : endPt;
      const distKm = haversineKm(node, nextPt);
      if (distKm < 0.08 && i < nodes.length - 1) continue;

      let maneuver: ManeuverType = 'straight';
      if (w === 0 && i === 0) {
        maneuver = 'depart';
      } else if (node.id === 'dewa_ruci') {
        maneuver = 'roundabout';
      } else if (i > 0) {
        const prevB = computeBearing(nodes[i - 1], node);
        const nextB = computeBearing(node, nextPt);
        maneuver = classifyTurn(prevB, nextB);
      }

      // Collapse consecutive straight steps on the same road
      const last = rawSteps[rawSteps.length - 1];
      if (last && last.roadName === roadName && maneuver === 'straight') {
        last.distanceM += Math.round(distKm * 1000);
        last.durationSec += Math.round((distKm / 30) * 3600);
      } else {
        rawSteps.push({
          id: `step-${w}-${i}`,
          roadName,
          maneuver,
          instruction: formatManeuverId(maneuver, roadName),
          distanceM: Math.max(120, Math.round(distKm * 1000)),
          durationSec: Math.max(20, Math.round((distKm / 30) * 3600)),
          location: { lat: node.lat, lng: node.lng },
        });
      }
    }
  }

  const dest = waypoints[waypoints.length - 1];
  const destNode = nearestRoadNode(dest);
  rawSteps.push({
    id: 'step-arrive',
    roadName: destNode.label,
    maneuver: 'arrive',
    instruction: formatManeuverId('arrive', destNode.label),
    distanceM: 0,
    durationSec: 0,
    location: dest,
  });

  const roadKm = Math.max(0.4, Math.round(totalKm * 1.08 * 10) / 10);
  const durationMin = Math.max(3, Math.round((roadKm / 28) * 60));

  return {
    coordinates: densifyPolyline(rawCoords),
    distanceKm: roadKm,
    durationMin,
    steps: rawSteps,
    source: 'bali-road-graph',
  };
}

// ─── OSRM Real Road Routing with Cache + Automatic Fallback ──────────────────

const routeCache = new Map<string, RoadRoute>();

function cacheKey(waypoints: LatLng[]): string {
  return waypoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(';');
}

function mapOsrmManeuver(type?: string, modifier?: string): ManeuverType {
  if (type === 'depart') return 'depart';
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return 'roundabout';
  if (modifier === 'uturn') return 'uturn';
  if (modifier === 'left' || modifier === 'sharp left') return 'turn-left';
  if (modifier === 'right' || modifier === 'sharp right') return 'turn-right';
  if (modifier === 'slight left') return 'slight-left';
  if (modifier === 'slight right') return 'slight-right';
  return 'straight';
}

export async function fetchRoadRoute(waypoints: LatLng[]): Promise<RoadRoute> {
  if (waypoints.length < 2) {
    return buildBaliFallbackRoute(waypoints);
  }
  const key = cacheKey(waypoints);
  const cached = routeCache.get(key);
  if (cached) return cached;

  const coordStr = waypoints.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3200);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates || route.geometry.coordinates.length < 2) {
      throw new Error('OSRM returned empty geometry');
    }

    const coordinates: LatLng[] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng }),
    );
    const distanceKm = Math.max(0.2, Math.round((route.distance / 1000) * 10) / 10);
    const durationMin = Math.max(2, Math.round(route.duration / 60));

    const steps: RouteStep[] = [];
    let stepIdx = 0;
    for (const leg of route.legs || []) {
      for (const s of leg.steps || []) {
        const maneuver = mapOsrmManeuver(s.maneuver?.type, s.maneuver?.modifier);
        const roadName = s.name || s.ref || 'Jalan utama';
        const loc = s.maneuver?.location
          ? { lat: s.maneuver.location[1], lng: s.maneuver.location[0] }
          : coordinates[0];
        steps.push({
          id: `osrm-${stepIdx++}`,
          roadName,
          maneuver,
          instruction: formatManeuverId(maneuver, roadName),
          distanceM: Math.round(s.distance || 0),
          durationSec: Math.round(s.duration || 0),
          location: loc,
        });
      }
    }

    const parsed: RoadRoute = {
      coordinates,
      distanceKm,
      durationMin,
      steps: steps.length > 0 ? steps : buildBaliFallbackRoute(waypoints).steps,
      source: 'osrm',
    };
    routeCache.set(key, parsed);
    return parsed;
  } catch {
    const fallback = buildBaliFallbackRoute(waypoints);
    routeCache.set(key, fallback);
    return fallback;
  }
}

/**
 * Splits a road route into traveled vs remaining segments relative to the driver's
 * current GPS coordinate, plus computes heading, remaining ETA, and next turn instruction.
 */
export function computeDriverRouteProgress(
  route: RoadRoute,
  driverPos: LatLng | null | undefined,
): {
  traveled: LatLng[];
  remaining: LatLng[];
  progress: number;
  heading: number;
  remainingKm: number;
  remainingMin: number;
  activeStep: RouteStep | null;
  nextStep: RouteStep | null;
  distanceToNextM: number;
} {
  const coords = route.coordinates;
  if (coords.length < 2) {
    return {
      traveled: [],
      remaining: coords,
      progress: 0,
      heading: 0,
      remainingKm: route.distanceKm,
      remainingMin: route.durationMin,
      activeStep: route.steps[0] || null,
      nextStep: route.steps[1] || null,
      distanceToNextM: route.steps[0]?.distanceM || 0,
    };
  }

  if (!driverPos) {
    return {
      traveled: [],
      remaining: coords,
      progress: 0,
      heading: computeBearing(coords[0], coords[1]),
      remainingKm: route.distanceKm,
      remainingMin: route.durationMin,
      activeStep: route.steps[0] || null,
      nextStep: route.steps[1] || null,
      distanceToNextM: route.steps[0]?.distanceM || 0,
    };
  }

  // Find closest vertex along road polyline
  let nearestIdx = 0;
  let minD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineKm(driverPos, coords[i]);
    if (d < minD) {
      minD = d;
      nearestIdx = i;
    }
  }

  const traveled = [...coords.slice(0, nearestIdx + 1), driverPos];
  const remaining = [driverPos, ...coords.slice(Math.min(nearestIdx + 1, coords.length - 1))];
  const progress = Math.max(0, Math.min(1, nearestIdx / Math.max(1, coords.length - 1)));

  const lookAheadIdx = Math.min(coords.length - 1, nearestIdx + 2);
  const lookBehindIdx = Math.max(0, nearestIdx - 1);
  const heading =
    lookAheadIdx > nearestIdx
      ? computeBearing(coords[nearestIdx], coords[lookAheadIdx])
      : computeBearing(coords[lookBehindIdx], coords[nearestIdx]);

  const remainingKm = Math.max(0.1, Math.round(route.distanceKm * (1 - progress) * 10) / 10);
  const remainingMin = Math.max(1, Math.round(route.durationMin * (1 - progress)));

  // Pick closest upcoming step
  const stepCount = route.steps.length;
  const activeStepIdx = Math.min(
    Math.max(0, stepCount - 1),
    Math.floor(progress * Math.max(1, stepCount - 1)),
  );
  const activeStep = route.steps[activeStepIdx] || null;
  const nextStep = route.steps[activeStepIdx + 1] || null;
  const distanceToNextM = nextStep
    ? Math.max(30, Math.round(haversineKm(driverPos, nextStep.location) * 1000))
    : Math.max(0, Math.round(remainingKm * 1000));

  return {
    traveled,
    remaining,
    progress,
    heading,
    remainingKm,
    remainingMin,
    activeStep,
    nextStep,
    distanceToNextM,
  };
}

export function formatStepDistance(meters: number): string {
  if (meters >= 1000) {
    const km = Math.round(meters / 100) / 10;
    return `${km.toFixed(1).replace('.', ',')} km`;
  }
  const rounded = Math.max(10, Math.round(meters / 10) * 10);
  return `${rounded} m`;
}
