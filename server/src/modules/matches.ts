import type { TripMatch } from '../../../shared/src/index.ts';
import { PACKAGE_SIZES, distanceKm, estimateRange } from '../../../shared/src/index.ts';
import { Router } from '../http/router.ts';
import { parse, v } from '../http/validate.ts';
import type { TripsService } from './trips.ts';
import { toTripDto } from './trips.ts';
import type { UsersService } from './users.ts';
import { toPublicUser } from './users.ts';
import { evaluateTrip } from './tripMatch.ts';

const point = v.object({ lat: v.number({ min: -90, max: 90 }), lng: v.number({ min: -180, max: 180 }) });
const searchBody = v.object({
  size: v.enum(PACKAGE_SIZES),
  pickup: point,
  dropoff: point,
  deliverBy: v.optional(v.datetime()),
});

/** S2 estimate + S3 "Driver searah" search. */
export function matchesService(trips: TripsService, users: UsersService) {
  return {
    /** "Estimasi Rp 5.000 – 12.000" before choosing a driver. */
    estimate(input: unknown) {
      const body = parse(input, v.object({ size: v.enum(PACKAGE_SIZES), pickup: point, dropoff: point }));
      const km = distanceKm(body.pickup, body.dropoff);
      return { distanceKm: Math.round(km * 10) / 10, range: estimateRange(body.size, km) };
    },

    /** Trips that can carry this package, "Langsung" first, then by price. */
    async search(userId: string, input: unknown): Promise<{ direct: TripMatch[]; detour: TripMatch[] }> {
      const spec = parse(input, searchBody);
      const candidates = await trips.repo.activeTrips(userId, spec.deliverBy ?? null);
      const slots = await trips.repo.slotsUsedMany(candidates.map((t) => t.id));
      const drivers = await users.repo.byIds(candidates.map((t) => t.driver_id));

      const matches: TripMatch[] = [];
      for (const t of candidates) {
        const e = evaluateTrip(t, slots.get(t.id) ?? 0, spec);
        if (!e.ok) continue;
        const driver = drivers.get(t.driver_id);
        matches.push({ trip: toTripDto(t, driver ? toPublicUser(driver) : null, slots.get(t.id) ?? 0), ...e.match });
      }
      matches.sort((a, b) => a.price.total - b.price.total || b.similarity - a.similarity);
      return {
        direct: matches.filter((m) => m.kind === 'direct'),
        detour: matches.filter((m) => m.kind === 'detour'),
      };
    },
  };
}

export function matchesRoutes(svc: ReturnType<typeof matchesService>): Router {
  const r = new Router();
  r.post('/matches/estimate', async (ctx) => svc.estimate(await ctx.json()));
  r.post('/matches/search', async (ctx) => svc.search(ctx.userId(), await ctx.json()));
  return r;
}
