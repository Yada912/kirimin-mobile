import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Play,
  Pause,
  FastForward,
  CheckCircle,
  Radio,
  MessageSquare,
  Package,
  MapPin,
  ShieldCheck,
  Navigation,
} from 'lucide-react-native';
import type { LatLng } from '@kirimin/shared';
import { colors, radii, spacing, shadows } from '../../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Button,
  StatusPill,
  MapView,
  MapMarker,
  SkeletonCard,
  ErrorState,
} from '../../../src/ui';
import {
  useTripManifest,
  useStartTrip,
  usePickupOrder,
  useArriveOrder,
  useCompleteTrip,
} from '../../../src/api/hooks/useApi';
import { api } from '../../../src/api/client';
import { interpolateAlongRoute } from '../../../src/constants/places';
import type { RoadRoute } from '../../../src/utils/routing';

export default function AngkutJalanScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const { data: manifest, isLoading, isError, error, refetch, isRefetching } = useTripManifest(tripId);

  const { mutateAsync: startTrip, isPending: isStarting } = useStartTrip();
  const { mutateAsync: pickupOrder, isPending: isPicking } = usePickupOrder();
  const { mutateAsync: arriveOrder, isPending: isArriving } = useArriveOrder();
  const { mutateAsync: completeTrip, isPending: isCompleting } = useCompleteTrip();

  const [liveGps, setLiveGps] = useState<LatLng | null>(null);
  const [simPlaying, setSimPlaying] = useState(true);
  const [routeProgress, setRouteProgress] = useState(0.08);
  const [actionError, setActionError] = useState<string | null>(null);

  const roadCoordsRef = useRef<LatLng[]>([]);
  const progressRef = useRef(0.08);

  const handleRouteComputed = (route: RoadRoute) => {
    if (route.coordinates.length >= 2) {
      roadCoordsRef.current = route.coordinates;
    }
  };

  // Push live GPS point along the ACTUAL road geometry
  const pushGpsPoint = async (nextProgress: number) => {
    if (!manifest?.trip) return;
    const path =
      roadCoordsRef.current.length >= 2
        ? roadCoordsRef.current
        : [manifest.trip.origin, ...(manifest.trip.stops || []), manifest.trip.destination];
    const pt = interpolateAlongRoute(path, nextProgress);
    setLiveGps(pt);
    setRouteProgress(nextProgress);
    progressRef.current = nextProgress;
    try {
      await api.post(`/trips/${tripId}/location`, pt);
    } catch {
      // ignore transient network glitches during live ping
    }
  };

  // Follow real road polyline every 4 seconds while trip is ongoing & simPlaying
  useEffect(() => {
    if (!manifest?.trip || manifest.trip.status !== 'ongoing' || !simPlaying) return;

    pushGpsPoint(progressRef.current);
    const timer = setInterval(() => {
      const next = progressRef.current >= 0.94 ? 0.08 : Number((progressRef.current + 0.08).toFixed(2));
      pushGpsPoint(next);
    }, 4000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest?.trip?.status, tripId, simPlaying]);

  const trip = manifest?.trip;
  const orders = manifest?.orders || [];

  // Build rich map markers including route origin/destination + package pickups/dropoffs
  const mapMarkers = useMemo<MapMarker[]>(() => {
    if (!trip) return [];
    const list: MapMarker[] = [
      {
        id: 'origin',
        lat: trip.origin.lat,
        lng: trip.origin.lng,
        title: trip.origin.label,
        subtitle: 'Titik awal perjalanan driver',
        color: colors.primary,
        type: 'pickup',
      },
    ];

    (trip.stops || []).forEach((s, idx) => {
      list.push({
        id: `trip-stop-${idx}`,
        lat: s.lat,
        lng: s.lng,
        title: s.label,
        subtitle: `Titik singgah rute #${idx + 1}`,
        color: colors.accent.amber,
        type: 'stop',
        orderIndex: idx + 1,
      });
    });

    orders.forEach((o, idx) => {
      if (o.status === 'accepted') {
        list.push({
          id: `order-pickup-${o.id}`,
          lat: o.pickup.lat,
          lng: o.pickup.lng,
          title: `Jemput #${idx + 1}: ${o.pickup.label}`,
          subtitle: `Pengirim ${o.sender.name} • Paket ${o.category} (${o.size})`,
          color: colors.accent.coral,
          type: 'stop',
          orderIndex: idx + 1,
        });
      }
      if (o.status !== 'delivered') {
        list.push({
          id: `order-drop-${o.id}`,
          lat: o.dropoff.lat,
          lng: o.dropoff.lng,
          title: `Antar #${idx + 1}: ${o.dropoff.label}`,
          subtitle: `Penerima ${o.recipient.name} • Kode ${o.code}`,
          color: colors.accent.violet,
          type: 'stop',
          orderIndex: idx + 1,
        });
      }
    });

    list.push({
      id: 'destination',
      lat: trip.destination.lat,
      lng: trip.destination.lng,
      title: trip.destination.label,
      subtitle: 'Tujuan akhir rute',
      color: colors.driver,
      type: 'dropoff',
    });

    return list;
  }, [trip, orders]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Navigasi Perjalanan" />
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !manifest || !trip) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Navigasi Perjalanan" />
        <ErrorState
          message={(error as any)?.message || 'Gagal memuat manifest perjalanan'}
          onRetry={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  const isPublished = trip.status === 'published';
  const isOngoing = trip.status === 'ongoing';
  const allDelivered = orders.length > 0 && orders.every((o) => o.status === 'delivered');
  const nextActiveOrder = orders.find((o) => o.status !== 'delivered') || null;
  const activeDriverGps = liveGps || trip.lastLocation || (isOngoing ? trip.origin : null);

  const handleStartTrip = async () => {
    try {
      setActionError(null);
      await startTrip(tripId);
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Gagal memulai perjalanan');
    }
  };

  const handlePickup = async (orderId: string) => {
    try {
      setActionError(null);
      await pickupOrder({ orderId });
      pushGpsPoint(Math.min(0.45, Math.max(progressRef.current, 0.32)));
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Gagal konfirmasi penjemputan');
    }
  };

  const handleArrive = async (orderId: string) => {
    try {
      setActionError(null);
      await arriveOrder(orderId);
      pushGpsPoint(Math.min(0.92, Math.max(progressRef.current, 0.85)));
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Gagal konfirmasi tiba di tujuan');
    }
  };

  const handleCompleteTrip = async () => {
    try {
      setActionError(null);
      await completeTrip(tripId);
      router.replace('/(angkut)/rute');
    } catch (err: any) {
      setActionError(err.message || 'Gagal menyelesaikan rute');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar
        title={trip.name}
        subtitle={`${trip.origin.label} → ${trip.destination.label}`}
        rightAction={<StatusPill status={trip.status} />}
      />

      {/* TOP HALF: Interactive Apple/Google Maps Style Live Road Navigation */}
      <View style={styles.mapHeroWrap}>
        <MapView
          pickup={trip.origin}
          dropoff={trip.destination}
          stops={trip.stops}
          markers={mapMarkers}
          driverLocation={activeDriverGps}
          height={310}
          showSettings
          navigationMode
          allowExpand
          onRouteComputed={handleRouteComputed}
          style={styles.mapHero}
        />

        {/* Compact Live Navigation Control Strip (always within reach) */}
        {isOngoing ? (
          <View style={styles.gpsControlStrip}>
            <View style={styles.gpsLeft}>
              <View style={styles.liveDot} />
              <Radio size={13} color={colors.driver} />
              <Text variant="captionMedium" color={colors.driverDeep} weight="700" style={{ marginLeft: 4 }}>
                GPS Live • {Math.round(routeProgress * 100)}%
              </Text>
            </View>
            <View style={styles.gpsActions}>
              <Pressable
                onPress={() => setSimPlaying((v) => !v)}
                style={styles.gpsMiniBtn}
                accessibilityLabel={simPlaying ? 'Jeda simulasi GPS' : 'Lanjut simulasi GPS'}
              >
                {simPlaying ? (
                  <Pause size={12} color={colors.driver} />
                ) : (
                  <Play size={12} color={colors.driver} />
                )}
                <Text variant="caption" color={colors.driver} weight="700" style={{ marginLeft: 3 }}>
                  {simPlaying ? 'Jeda' : 'Jalan'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  pushGpsPoint(
                    progressRef.current >= 0.92 ? 0.1 : Number((progressRef.current + 0.16).toFixed(2)),
                  )
                }
                style={styles.gpsMiniBtn}
                accessibilityLabel="Majukan posisi driver di rute"
              >
                <FastForward size={12} color={colors.primary} />
                <Text variant="caption" color={colors.primary} weight="700" style={{ marginLeft: 3 }}>
                  Maju
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* BOTTOM HALF: Primary Action Above the Fold + Scrollable Manifest Details */}
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
            }}
            tintColor={colors.driver}
          />
        }
      >
        {actionError ? (
          <Card variant="flat" padding="sm" style={styles.errorCard}>
            <Text variant="captionMedium" color={colors.semantic.danger}>
              {actionError}
            </Text>
          </Card>
        ) : null}

        {/* PRIMARY ABOVE-THE-FOLD ACTION CARD (Thumb-reach first, no scrolling needed!) */}
        {isPublished ? (
          <Card variant="elevated" padding="md" style={styles.primaryActionCard}>
            <View style={styles.primaryActionHeader}>
              <View style={styles.driverIconCircle}>
                <Navigation size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="headline" color={colors.text.primary} weight="700">
                  Siap Berangkat ({orders.length} Paket)
                </Text>
                <Text variant="caption" color={colors.text.secondary}>
                  Aktifkan navigasi rute & kirim posisi live ke pengirim
                </Text>
              </View>
            </View>
            <Button
              label="Mulai Perjalanan & Navigasi"
              variant="primary"
              size="lg"
              leftIcon={<Play size={18} color="#FFF" />}
              loading={isStarting}
              onPress={handleStartTrip}
              style={styles.emeraldBtn}
            />
          </Card>
        ) : isOngoing && allDelivered ? (
          <Card variant="elevated" padding="md" style={styles.completeHeroCard}>
            <View style={styles.primaryActionHeader}>
              <CheckCircle size={28} color={colors.driver} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="headline" color={colors.driverDeep} weight="700">
                  Semua Paket Selesai Diantar!
                </Text>
                <Text variant="caption" color={colors.text.secondary}>
                  Tutup perjalanan untuk mencatat pendapatan ke dompet driver.
                </Text>
              </View>
            </View>
            <Button
              label="Selesaikan Rute Perjalanan"
              variant="primary"
              size="lg"
              loading={isCompleting}
              onPress={handleCompleteTrip}
              style={styles.emeraldBtn}
            />
          </Card>
        ) : isOngoing && nextActiveOrder ? (
          <Card variant="elevated" padding="md" style={styles.activeStopCard}>
            <View style={styles.activeStopTop}>
              <View style={styles.nextPill}>
                <Package size={12} color={colors.driverDeep} />
                <Text variant="captionMedium" color={colors.driverDeep} weight="700" style={{ marginLeft: 4 }}>
                  {nextActiveOrder.status === 'accepted'
                    ? 'TAHAP BERIKUTNYA: JEMPUT'
                    : nextActiveOrder.status === 'arrived'
                      ? 'TAHAP BERIKUTNYA: SERAH TERIMA'
                      : 'TAHAP BERIKUTNYA: ANTAR'}
                </Text>
              </View>
              <StatusPill status={nextActiveOrder.status} />
            </View>

            <Text variant="headline" color={colors.text.primary} weight="700" numberOfLines={1}>
              {nextActiveOrder.status === 'accepted'
                ? nextActiveOrder.pickup.label
                : nextActiveOrder.dropoff.label}
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2, marginBottom: spacing.sm }}>
              {nextActiveOrder.code} •{' '}
              {nextActiveOrder.status === 'accepted'
                ? `Pengirim: ${nextActiveOrder.sender.name}`
                : `Penerima: ${nextActiveOrder.recipient.name} (${nextActiveOrder.recipient.phone})`}
            </Text>

            <View style={styles.primaryBtnRow}>
              <View style={{ flex: 1 }}>
                {nextActiveOrder.status === 'accepted' && (
                  <Button
                    label="Konfirmasi Dijemput"
                    variant="primary"
                    size="md"
                    loading={isPicking}
                    onPress={() => handlePickup(nextActiveOrder.id)}
                    style={styles.emeraldBtn}
                  />
                )}
                {(nextActiveOrder.status === 'picked_up' || nextActiveOrder.status === 'in_transit') && (
                  <Button
                    label="Konfirmasi Tiba di Lokasi"
                    variant="primary"
                    size="md"
                    loading={isArriving}
                    onPress={() => handleArrive(nextActiveOrder.id)}
                    style={styles.emeraldBtn}
                  />
                )}
                {nextActiveOrder.status === 'arrived' && (
                  <Button
                    label="Masukkan Kode 4 Digit"
                    variant="primary"
                    size="md"
                    leftIcon={<ShieldCheck size={16} color="#FFF" />}
                    onPress={() =>
                      router.push({
                        pathname: '/serah-terima/[orderId]',
                        params: { orderId: nextActiveOrder.id },
                      })
                    }
                    style={styles.emeraldBtn}
                  />
                )}
              </View>

              <Button
                label="Chat"
                variant="outline"
                size="md"
                fullWidth={false}
                leftIcon={<MessageSquare size={15} color={colors.primary} />}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[orderId]',
                    params: { orderId: nextActiveOrder.id },
                  })
                }
              />
            </View>
          </Card>
        ) : null}

        {/* BELOW THE FOLD: Full Package Manifest */}
        <View style={styles.manifestHeader}>
          <Text variant="headline" color={colors.text.primary} weight="700">
            Manifest Paket ({orders.length})
          </Text>
          <Text variant="caption" color={colors.text.secondary}>
            Ketuk peta di atas untuk melihat panduan belokan
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
                      {o.sender.name} • {o.category} ({o.size})
                    </Text>
                  </View>
                  <StatusPill status={o.status} />
                </View>

                <View style={styles.addressBox}>
                  <View style={styles.addrLine}>
                    <MapPin size={13} color={colors.primary} />
                    <Text variant="calloutSemibold" color={colors.text.primary} style={{ marginLeft: 5, flex: 1 }}>
                      Jemput: {o.pickup.label}
                    </Text>
                  </View>
                  <View style={[styles.addrLine, { marginTop: 4 }]}>
                    <MapPin size={13} color={colors.driver} />
                    <Text variant="calloutSemibold" color={colors.text.primary} style={{ marginLeft: 5, flex: 1 }}>
                      Antar: {o.dropoff.label} ({o.recipient.name})
                    </Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  {o.status === 'accepted' && (
                    <Button
                      label="Konfirmasi Dijemput"
                      variant="primary"
                      size="sm"
                      fullWidth={false}
                      loading={isPicking}
                      onPress={() => handlePickup(o.id)}
                    />
                  )}

                  {(o.status === 'picked_up' || o.status === 'in_transit') && (
                    <Button
                      label="Konfirmasi Tiba"
                      variant="primary"
                      size="sm"
                      fullWidth={false}
                      loading={isArriving}
                      onPress={() => handleArrive(o.id)}
                    />
                  )}

                  {o.status === 'arrived' && (
                    <Button
                      label="Kode Serah Terima"
                      variant="primary"
                      size="sm"
                      fullWidth={false}
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
                        Selesai Diserahkan
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapHeroWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  mapHero: {
    borderRadius: radii.xl,
    ...shadows.card,
  },
  gpsControlStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.driverSubtle,
    borderWidth: 1,
    borderColor: colors.driverLight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.xs,
  },
  gpsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.driver,
    marginRight: 6,
  },
  gpsActions: {
    flexDirection: 'row',
    gap: 6,
  },
  gpsMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetScroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 36,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.sm,
  },
  primaryActionCard: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.driver,
    marginBottom: spacing.md,
  },
  primaryActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  driverIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.driver,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emeraldBtn: {
    backgroundColor: colors.driver,
  },
  completeHeroCard: {
    backgroundColor: colors.driverSubtle,
    borderWidth: 1,
    borderColor: colors.driverLight,
    marginBottom: spacing.md,
  },
  activeStopCard: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.driver,
    marginBottom: spacing.md,
  },
  activeStopTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  nextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.driverLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  primaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  manifestHeader: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  orderList: {
    gap: spacing.sm,
  },
  orderCard: {
    backgroundColor: colors.surface,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
  addrLine: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
