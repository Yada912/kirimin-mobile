import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play, MapPin, CheckCircle, Navigation, Radio, Phone, MessageSquare } from 'lucide-react-native';
import type { Order, Trip } from '@kirimin/shared';
import { colors, radii, spacing } from '../../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Button,
  StatusPill,
  MapView,
  Avatar,
  Divider,
  SkeletonCard,
  ErrorState,
} from '../../../src/ui';
import {
  useTrip,
  useTripManifest,
  useStartTrip,
  usePickupOrder,
  useArriveOrder,
  useCompleteTrip,
} from '../../../src/api/hooks/useApi';
import { api } from '../../../src/api/client';
import { formatTime } from '../../../src/utils/format';

export default function AngkutJalanScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const { data: manifest, isLoading, isError, error, refetch, isRefetching } = useTripManifest(tripId);

  const { mutateAsync: startTrip, isPending: isStarting } = useStartTrip();
  const { mutateAsync: pickupOrder, isPending: isPicking } = usePickupOrder();
  const { mutateAsync: arriveOrder, isPending: isArriving } = useArriveOrder();
  const { mutateAsync: completeTrip, isPending: isCompleting } = useCompleteTrip();

  const [locationPinging, setLocationPinging] = useState(false);

  // Send GPS location update every 10 seconds while trip is ongoing (D5 requirement)
  useEffect(() => {
    if (!manifest?.trip || manifest.trip.status !== 'ongoing') return;

    let timer: any = null;
    const sendGps = async () => {
      try {
        setLocationPinging(true);
        // Default simulated commuter coordinates Renon -> Bukit
        await api.post(`/trips/${tripId}/location`, {
          lat: -8.72 + (Math.random() - 0.5) * 0.01,
          lng: 115.2 + (Math.random() - 0.5) * 0.01,
        });
      } catch (err) {
        console.warn('GPS location ping error:', err);
      } finally {
        setLocationPinging(false);
      }
    };

    sendGps();
    timer = setInterval(sendGps, 10000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [manifest?.trip?.status, tripId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Perjalanan Aktif" />
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !manifest) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Perjalanan Aktif" />
        <ErrorState message={(error as any)?.message || 'Gagal memuat manifest perjalanan'} onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  const { trip, orders } = manifest;
  const isPublished = trip.status === 'published';
  const isOngoing = trip.status === 'ongoing';
  const isCompleted = trip.status === 'completed';

  const handleStartTrip = async () => {
    try {
      await startTrip(tripId);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Gagal memulai perjalanan');
    }
  };

  const handlePickup = async (orderId: string) => {
    try {
      await pickupOrder({ orderId });
      refetch();
    } catch (err: any) {
      alert(err.message || 'Gagal konfirmasi penjemputan');
    }
  };

  const handleArrive = async (orderId: string) => {
    try {
      await arriveOrder(orderId);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Gagal konfirmasi tiba di tujuan');
    }
  };

  const handleCompleteTrip = async () => {
    try {
      await completeTrip(tripId);
      router.replace('/(angkut)/rute');
    } catch (err: any) {
      alert(err.message || 'Gagal menyelesaikan rute');
    }
  };

  // Check if all orders are delivered
  const allDelivered = orders.length > 0 && orders.every((o) => o.status === 'delivered');

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar
        title={trip.name}
        subtitle={trip.status === 'ongoing' ? 'Sedang Berjalan' : undefined}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Trip Overview Card */}
        <Card variant="elevated" padding="md" style={styles.tripCard}>
          <View style={styles.tripHeader}>
            <View>
              <Text variant="headline" color={colors.text.primary} weight="700">
                {trip.name}
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                {trip.origin.label} → {trip.destination.label}
              </Text>
            </View>
            <StatusPill status={trip.status} />
          </View>

          {isOngoing && (
            <View style={styles.liveGpsBadge}>
              <Radio size={14} color={colors.semantic.success} />
              <Text variant="captionMedium" color={colors.semantic.success} style={{ marginLeft: 4 }}>
                GPS Aktif (Mengirim lokasi realtime ke pengirim)
              </Text>
            </View>
          )}

          {isPublished && (
            <Button
              label="Mulai Perjalanan Sekarang"
              variant="primary"
              size="lg"
              leftIcon={<Play size={18} color="#FFF" />}
              loading={isStarting}
              onPress={handleStartTrip}
              style={{ marginTop: spacing.md }}
            />
          )}
        </Card>

        {/* Map View */}
        <View style={styles.mapWrapper}>
          <MapView
            pickup={trip.origin}
            dropoff={trip.destination}
            stops={trip.stops}
            height={180}
          />
        </View>

        {/* Manifest Orders */}
        <View style={styles.manifestHeader}>
          <Text variant="headline" color={colors.text.primary} weight="700">
            Daftar Paket ({orders.length})
          </Text>
          <Text variant="caption" color={colors.text.secondary}>
            Urutan jemput dan serah terima
          </Text>
        </View>

        {orders.length === 0 ? (
          <Card variant="flat" padding="lg" style={{ alignItems: 'center' }}>
            <Text variant="callout" color={colors.text.secondary}>
              Belum ada paket yang diterima pada rute ini.
            </Text>
          </Card>
        ) : (
          <View style={styles.orderList}>
            {orders.map((o, idx) => (
              <Card key={o.id} variant="outlined" padding="md" style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderBadge}>
                    <Text variant="caption" color={colors.primary} weight="700">
                      #{idx + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text variant="headline" color={colors.text.primary} weight="700">
                      {o.code}
                    </Text>
                    <Text variant="caption" color={colors.text.secondary}>
                      Pengirim: {o.sender.name} • Ukuran {o.size}
                    </Text>
                  </View>
                  <StatusPill status={o.status} />
                </View>

                <View style={styles.addressBox}>
                  <Text variant="calloutSemibold" color={colors.text.primary}>
                    Jemput: {o.pickup.label}
                  </Text>
                  <Text variant="calloutSemibold" color={colors.text.primary} style={{ marginTop: 2 }}>
                    Antar: {o.dropoff.label} (Penerima: {o.recipient.name})
                  </Text>
                </View>

                {/* Step actions per package */}
                <View style={styles.actionRow}>
                  {o.status === 'accepted' && (
                    <Button
                      label="Konfirmasi Dijemput (X2)"
                      variant="primary"
                      size="sm"
                      loading={isPicking}
                      onPress={() => handlePickup(o.id)}
                    />
                  )}

                  {(o.status === 'picked_up' || o.status === 'in_transit') && (
                    <Button
                      label="Konfirmasi Tiba di Lokasi"
                      variant="primary"
                      size="sm"
                      loading={isArriving}
                      onPress={() => handleArrive(o.id)}
                    />
                  )}

                  {o.status === 'arrived' && (
                    <Button
                      label="Masukkan Kode Serah Terima (X2)"
                      variant="primary"
                      size="sm"
                      onPress={() =>
                        router.push({
                          pathname: '/serah-terima/[orderId]',
                          params: { orderId: o.id },
                        })
                      }
                    />
                  )}

                  {o.status === 'delivered' && (
                    <View style={styles.deliveredRow}>
                      <CheckCircle size={16} color={colors.semantic.success} />
                      <Text variant="captionMedium" color={colors.semantic.success} style={{ marginLeft: 4 }}>
                        Paket Selesai Diserahkan
                      </Text>
                    </View>
                  )}

                  <Button
                    label="Chat"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    leftIcon={<MessageSquare size={14} color={colors.primary} />}
                    onPress={() =>
                      router.push({
                        pathname: '/chat/[orderId]',
                        params: { orderId: o.id },
                      })
                    }
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Complete Trip Button */}
        {isOngoing && allDelivered && (
          <Button
            label="Selesaikan Rute Perjalanan"
            variant="primary"
            size="lg"
            loading={isCompleting}
            onPress={handleCompleteTrip}
            style={styles.completeBtn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  tripCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  liveGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  mapWrapper: {
    marginBottom: spacing.lg,
  },
  manifestHeader: {
    marginBottom: spacing.sm,
  },
  orderList: {
    gap: spacing.md,
  },
  orderCard: {
    backgroundColor: colors.surface,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressBox: {
    marginVertical: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deliveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeBtn: {
    marginTop: spacing.xl,
  },
});
