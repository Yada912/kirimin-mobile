/**
 * Push notifications through Expo's push service (https://exp.host), which
 * forwards to FCM (Android) and APNs (iOS). Plain `fetch`, no SDK.
 *
 * The app gets its token with `Notifications.getExpoPushTokenAsync({ projectId })`
 * and registers it with `POST /me/push-tokens`. Sending never blocks or fails a
 * request: errors are logged and tokens Expo reports as dead are removed.
 */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushSender {
  /** Resolves with the tokens that are no longer valid (uninstalled app, etc.). */
  send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }>;
}

export const EXPO_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo accepts up to 100 messages per request

interface Ticket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export function expoPushSender(accessToken: string | null): PushSender {
  return {
    async send(messages) {
      const invalidTokens: string[] = [];
      for (let i = 0; i < messages.length; i += BATCH) {
        const batch = messages.slice(i, i + BATCH);
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(batch.map((m) => ({ ...m, sound: 'default', priority: 'high', channelId: 'default' }))),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Expo push HTTP ${res.status}: ${await res.text()}`);
        const { data } = (await res.json()) as { data?: Ticket[] };
        (data ?? []).forEach((ticket, j) => {
          if (ticket.status !== 'error') return;
          if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(batch[j].to);
          else console.warn(`push to ${batch[j].to} failed: ${ticket.message ?? ticket.details?.error}`);
        });
      }
      return { invalidTokens };
    },
  };
}

/** Used when push is disabled. */
export const noopPushSender: PushSender = {
  async send() {
    return { invalidTokens: [] };
  },
};

/** Keeps every message in memory; handy for tests. */
export function recordingPushSender(): PushSender & { sent: PushMessage[]; invalid: Set<string> } {
  const sent: PushMessage[] = [];
  const invalid = new Set<string>();
  return {
    sent,
    invalid,
    async send(messages) {
      sent.push(...messages);
      return { invalidTokens: messages.map((m) => m.to).filter((t) => invalid.has(t)) };
    },
  };
}
