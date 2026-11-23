import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Order,
  Trip,
  TripMatch,
  IncomingRequest,
  ChatMessage,
  Rating,
  Notification,
  PackageSize,
  LatLng,
  Place,
  Role,
  PaymentMethod,
  PaymentChannel,
  PaymentTransaction,
  SavedPlace,
  SavedPlaceKind,
  UserSettings,
  Me,
  Vehicle,
  WalletSummary,
  RoutePreset,
} from '@kirimin/shared';
import { api } from '../client';

// ─── Query Keys ─────────────────────────────────────────────────────────────
export const queryKeys = {
  meta: ['meta'] as const,
  me: ['me'] as const,
  stats: ['stats'] as const,
  savedPlaces: ['me', 'places'] as const,
  settings: ['me', 'settings'] as const,
  wallet: ['wallet'] as const,
  orders: (role: Role, scope: string) => ['orders', role, scope] as const,
  order: (id: string) => ['order', id] as const,
  orderPayment: (orderId: string) => ['order', orderId, 'payment'] as const,
  tripsMine: (scope: string) => ['trips', 'mine', scope] as const,
  trip: (id: string) => ['trip', id] as const,
  tripRequests: (tripId: string) => ['trip', tripId, 'requests'] as const,
  tripManifest: (tripId: string) => ['trip', tripId, 'manifest'] as const,
  messages: (orderId: string) => ['messages', orderId] as const,
  notifications: ['notifications'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────
export function useMeta() {
  return useQuery({
    queryKey: queryKeys.meta,
    queryFn: () => api.get<any>('/meta'),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => api.get<any>('/me/stats'),
  });
}

export function useOrders(as: Role, scope: 'active' | 'history' | 'all' = 'active') {
  return useQuery({
    queryKey: queryKeys.orders(as, scope),
    queryFn: () => api.get<Order[]>('/orders', { as, scope }),
    refetchInterval: 5000, // Polling fallback
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.order(id || ''),
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: !!id,
    refetchInterval: 4000, // Poll fallback for live status
  });
}

export function useTripsMine(scope: 'active' | 'history' = 'active') {
  return useQuery({
    queryKey: queryKeys.tripsMine(scope),
    queryFn: () => api.get<Trip[]>('/trips/mine', { scope }),
    refetchInterval: 8000,
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.trip(id || ''),
    queryFn: () => api.get<Trip>(`/trips/${id}`),
    enabled: !!id,
  });
}

export function useTripRequests(tripId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tripRequests(tripId || ''),
    queryFn: () => api.get<IncomingRequest[]>(`/trips/${tripId}/requests`),
    enabled: !!tripId,
    refetchInterval: 5000,
  });
}

export function useTripManifest(tripId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tripManifest(tripId || ''),
    queryFn: () =>
      api.get<{ trip: Trip; stops: any[]; orders: Order[] }>(`/trips/${tripId}/manifest`),
    enabled: !!tripId,
    refetchInterval: 5000,
  });
}

export function useOrderMessages(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.messages(orderId || ''),
    queryFn: () => api.get<ChatMessage[]>(`/orders/${orderId}/messages`),
    enabled: !!orderId,
    refetchInterval: 3000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api.get<{ items: Notification[]; unreadCount: number }>('/notifications'),
    refetchInterval: 10000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────
export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post<Order>('/orders', body),
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.setQueryData(queryKeys.order(newOrder.id), newOrder);
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<Order>(`/orders/${id}/cancel`, { reason }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.setQueryData(queryKeys.order(updated.id), updated);
    },
  });
}

export function usePayOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: PaymentMethod }) =>
      api.post<Order>(`/orders/${id}/pay`, { method }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.order(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => api.post<Trip>('/trips', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useStartTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => api.post<Trip>(`/trips/${tripId}/start`),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(updated.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(updated.id) });
    },
  });
}

export function useCompleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => api.post<Trip>(`/trips/${tripId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useCancelTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, reason }: { tripId: string; reason?: string }) =>
      api.post<Trip>(`/trips/${tripId}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useAcceptOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, tripId }: { orderId: string; tripId?: string }) =>
      api.post<Order>(`/orders/${orderId}/accept`, tripId ? { tripId } : {}),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['trip'] });
      queryClient.setQueryData(queryKeys.order(updated.id), updated);
    },
  });
}

export function useDeclineOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      api.post<Order>(`/orders/${orderId}/decline`, { reason }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['trip'] });
      queryClient.setQueryData(queryKeys.order(updated.id), updated);
    },
  });
}

export function usePickupOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, photoUrl }: { orderId: string; photoUrl?: string }) =>
      api.post<Order>(`/orders/${orderId}/pickup`, { photoUrl }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['trip'] });
      queryClient.setQueryData(queryKeys.order(updated.id), updated);
    },
  });
}

export function useArriveOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.post<Order>(`/orders/${orderId}/arrive`),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['trip'] });
      queryClient.setQueryData(queryKeys.order(updated.id), updated);
    },
  });
}

export function useDeliverOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      code,
      photoUrl,
    }: {
      orderId: string;
      code: string;
      photoUrl?: string;
    }) => api.post<Order>(`/orders/${orderId}/deliver`, { code, photoUrl }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['trip'] });
      queryClient.setQueryData(queryKeys.order(updated.id), updated);
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, body }: { orderId: string; body: string }) =>
      api.post<ChatMessage>(`/orders/${orderId}/messages`, { body }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(vars.orderId) });
    },
  });
}

export function useRateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      stars,
      tags,
      comment,
    }: {
      orderId: string;
      stars: number;
      tags?: string[];
      comment?: string;
    }) => api.post<Rating>(`/orders/${orderId}/rating`, { stars, tags, comment }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.order(vars.orderId) });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useReadAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

// ─── Saved Places, Settings/Presets, Profile, Wallet, Trip Edit ──────────────

export function useSavedPlaces() {
  return useQuery({
    queryKey: queryKeys.savedPlaces,
    queryFn: () => api.get<SavedPlace[]>('/me/places'),
  });
}

export function useCreateSavedPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      kind?: SavedPlaceKind;
      label: string;
      address?: string;
      lat: number;
      lng: number;
    }) => api.post<SavedPlace>('/me/places', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedPlaces });
    },
  });
}

export function useUpdateSavedPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      kind?: SavedPlaceKind;
      label?: string;
      address?: string | null;
      lat?: number;
      lng?: number;
    }) => api.patch<SavedPlace>(`/me/places/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedPlaces });
    },
  });
}

export function useDeleteSavedPlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/me/places/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedPlaces });
    },
  });
}

export function useUserSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.get<UserSettings>('/me/settings'),
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      push?: Partial<UserSettings['push']>;
      routePresets?: RoutePreset[];
    }) => api.patch<UserSettings>('/me/settings', body),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings, updated);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name?: string;
      email?: string | null;
      avatarUrl?: string | null;
      activeRole?: Role;
      vehicle?: Vehicle | null;
    }) => api.patch<Me>('/me', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useSubmitVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { ktpPhotoUrl: string; selfiePhotoUrl: string }) =>
      api.post<Me>('/me/verification', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, ...body }: { tripId: string } & Record<string, any>) =>
      api.patch<Trip>(`/trips/${tripId}`, body),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.setQueryData(queryKeys.trip(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.tripManifest(updated.id) });
    },
  });
}

export function useWallet() {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => api.get<WalletSummary>('/wallet'),
  });
}

// ─── Payment Gateway Hooks (Intents, Live Status, Sandbox Webhook) ──────────

export function useOrderPayment(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orderPayment(orderId || ''),
    queryFn: () => api.get<PaymentTransaction | null>(`/orders/${orderId}/payments/latest`),
    enabled: !!orderId,
    refetchInterval: 4000,
  });
}

export function useCreatePaymentIntent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      method,
      channel,
      idempotencyKey,
    }: {
      orderId: string;
      method: PaymentMethod;
      channel?: PaymentChannel;
      idempotencyKey?: string;
    }) =>
      api.post<PaymentTransaction>(`/orders/${orderId}/payments`, {
        method,
        channel,
        idempotencyKey,
      }),
    onSuccess: (tx) => {
      queryClient.setQueryData(queryKeys.orderPayment(tx.orderId), tx);
      queryClient.invalidateQueries({ queryKey: queryKeys.order(tx.orderId) });
    },
  });
}

export function useSimulatePaymentWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paymentId,
      outcome,
      failureReason,
    }: {
      paymentId: string;
      outcome: 'settlement' | 'expire' | 'failure';
      failureReason?: string;
    }) =>
      api.post<{ ok: boolean; idempotent: boolean; payment: PaymentTransaction }>(
        `/payments/${paymentId}/sandbox/simulate`,
        { outcome, failureReason },
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKeys.orderPayment(res.payment.orderId), res.payment);
      queryClient.invalidateQueries({ queryKey: queryKeys.order(res.payment.orderId) });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}



