import { useEffect, useRef, useState } from 'react';
import EventSource from 'react-native-sse';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeEvent } from '@kirimin/shared';
import { getApiBaseUrl, onServerUrlChange } from '../utils/config';
import { useAuth } from '../auth/AuthContext';
import { queryKeys } from './hooks/useApi';

export function useRealtimeSubscription() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  // Bumped when the user points the app at a different server, so we reconnect there.
  const [serverKey, setServerKey] = useState(0);
  useEffect(() => onServerUrlChange(() => setServerKey((k) => k + 1)), []);

  useEffect(() => {
    if (!token) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let es: EventSource<RealtimeEvent['type']> | null = null;

    getApiBaseUrl().then((baseUrl) => {
      if (cancelled) return;
      const sseUrl = `${baseUrl}/events?token=${encodeURIComponent(token)}`;
      // The server sends *named* events ("event: order.updated"), which EventSource only
      // delivers to listeners registered under that name — never to 'message'.
      es = new EventSource<RealtimeEvent['type']>(sseUrl, {
        headers: {
          'ngrok-skip-browser-warning': '1',
        },
      });
      esRef.current = es;

      es.addEventListener('open', () => {
        // Connected
      });

    const handle = (event: { data?: string | null }) => {
      try {
        if (!event.data) return;
        const data: RealtimeEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'order.updated': {
            const order = data.order;
            queryClient.setQueryData(queryKeys.order(order.id), order);
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['trip'] });
            break;
          }
          case 'message.created': {
            const msg = data.message;
            queryClient.invalidateQueries({ queryKey: queryKeys.messages(msg.orderId) });
            break;
          }
          case 'notification.created': {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
            break;
          }
          case 'trip.location': {
            queryClient.invalidateQueries({ queryKey: queryKeys.trip(data.tripId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(data.tripId) });
            break;
          }
          case 'payment.updated': {
            const payment = data.payment;
            queryClient.setQueryData(queryKeys.orderPayment(payment.orderId), payment);
            queryClient.invalidateQueries({ queryKey: queryKeys.order(payment.orderId) });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            break;
          }
        }
      } catch (err) {
        console.warn('Error parsing SSE event:', err);
      }
    };

    // One line per event in shared/src/api.ts → RealtimeEvent (a contract test checks this list).
    es.addEventListener('order.updated', handle);
    es.addEventListener('message.created', handle);
    es.addEventListener('notification.created', handle);
    es.addEventListener('trip.location', handle);
    es.addEventListener('payment.updated', handle);

    es.addEventListener('error', () => {
      // Stream drop is gracefully handled; react-query polling remains active fallback
    });
    });

    return () => {
      cancelled = true;
      if (es) es.close();
      esRef.current = null;
    };
  }, [token, queryClient, serverKey]);
}

