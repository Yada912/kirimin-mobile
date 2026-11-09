import { useEffect, useRef } from 'react';
import EventSource from 'react-native-sse';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeEvent } from '@kirimin/shared';
import { API_BASE_URL } from '../utils/config';
import { useAuth } from '../auth/AuthContext';
import { queryKeys } from './hooks/useApi';

export function useRealtimeSubscription() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    const sseUrl = `${API_BASE_URL}/events?token=${encodeURIComponent(token)}`;
    // The server sends *named* events ("event: order.updated"), which EventSource only
    // delivers to listeners registered under that name — never to 'message'.
    const es = new EventSource<RealtimeEvent['type']>(sseUrl, {
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

    es.addEventListener('error', (err) => {
      // Stream drop is gracefully handled; react-query polling remains active fallback
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [token, queryClient]);
}

