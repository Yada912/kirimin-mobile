import type { ServerResponse } from 'node:http';
import type { RealtimeEvent } from '../../../shared/src/index.ts';

/**
 * Pushes events to connected users over Server-Sent Events (GET /events).
 *
 * SSE is plain HTTP, works through Cloudflare Tunnel and free hosts, and needs no
 * library on the server. In React Native use `react-native-sse` (or poll).
 * Everything lives in memory, which is fine for one server process; if you ever
 * run several instances, put a pub/sub (e.g. Redis/Upstash) behind `publish`.
 */
export interface Hub {
  connect(userId: string, res: ServerResponse): void;
  publish(userIds: Iterable<string | null | undefined>, event: RealtimeEvent): void;
  connectedCount(): number;
  closeAll(): void;
}

export function createHub(): Hub {
  const clients = new Map<string, Set<ServerResponse>>();
  let heartbeat: NodeJS.Timeout | null = null;

  const send = (res: ServerResponse, event: RealtimeEvent) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  const ensureHeartbeat = () => {
    if (heartbeat) return;
    // Comment lines keep proxies (and Cloudflare's ~100 s idle timeout) from closing the stream.
    heartbeat = setInterval(() => {
      for (const set of clients.values()) for (const res of set) res.write(': ping\n\n');
    }, 25_000);
    heartbeat.unref();
  };

  return {
    connect(userId, res) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      let set = clients.get(userId);
      if (!set) clients.set(userId, (set = new Set()));
      set.add(res);
      ensureHeartbeat();
      res.on('close', () => {
        set.delete(res);
        if (set.size === 0) clients.delete(userId);
      });
    },

    publish(userIds, event) {
      const seen = new Set<string>();
      for (const id of userIds) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        for (const res of clients.get(id) ?? []) send(res, event);
      }
    },

    connectedCount() {
      let n = 0;
      for (const s of clients.values()) n += s.size;
      return n;
    },

    closeAll() {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      for (const set of clients.values()) for (const res of set) res.end();
      clients.clear();
    },
  };
}
