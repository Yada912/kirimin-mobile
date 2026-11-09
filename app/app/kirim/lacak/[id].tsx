import React from 'react';
import { StyleSheet, View, ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageSquare, Phone, ShieldCheck, MapPin, Star, AlertTriangle } from 'lucide-react-native';
import { colors, radii, spacing } from '../../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  StatusPill,
  ProgressSteps,
  CodeDisplay,
  MapView,
  Avatar,
  Button,
  Divider,
  PriceRow,
  SkeletonCard,
  ErrorState,
} from '../../../src/ui';
import { useOrder, useTrip } from '../../../src/api/hooks/useApi';
import { formatDateTime, formatRupiah } from '../../../src/utils/format';

export default function LacakPesananScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isError, error, refetch, isRefetching } = useOrder(id);
  const { data: trip } = useTrip(order?.tripId || undefined);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Lacak Pesanan" />
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Lacak Pesanan" />
        <ErrorState
          message={(error as any)?.message || 'Pesanan tidak ditemukan.'}
          onRetry={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  const isCompleted = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled' || order.status === 'declined' || order.status === 'expired';
  const canCancel = ['open', 'requested', 'accepted'].includes(order.status);

  // Driver GPS position from trip if available
  const driverGps = trip?.lastLocation
    ? { lat: trip.lastLocation.lat, lng: trip.lastLocation.lng }
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar
        title={`Pesanan ${order.code}`}
        rightAction={
          order.driver ? (
            <Button
              label="Chat"
              variant="ghost"
              size="sm"
              leftIcon={<MessageSquare size={16} color={colors.primary} />}
              onPress={() => router.push({ pathname: '/chat/[orderId]', params: { orderId: order.id } })}
            />
          ) : undefined
        }
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
        {/* Status Card */}
        <Card variant="elevated" padding="lg" style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text variant="headline" color={colors.text.primary} weight="700">
                Status Pengiriman
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Pembaruan otomatis secara realtime
              </Text>
            </View>
            <StatusPill status={order.status} />
          </View>

          {/* 5-Step Tracker */}
          <ProgressSteps currentStatus={order.status} style={{ marginVertical: spacing.sm }} />
        </Card>

        {/* 4-Digit Handover Code (Critical for Definition of Done) */}
        {order.handoverCode && !isCompleted && !isCancelled && (
          <CodeDisplay
            code={order.handoverCode}
            label="Kode Serah Terima (4 Digit)"
            hint="Berikan kode ini ke penerima paket. Driver akan meminta kode ini di lokasi tujuan untuk menyelesaikan pengantaran."
            style={styles.codeCard}
          />
        )}

        {/* Map View */}
        <View style={styles.mapSection}>
          <MapView
            pickup={order.pickup}
            dropoff={order.dropoff}
            driverLocation={driverGps}
            height={200}
          />
        </View>

        {/* Driver Card */}
        {order.driver ? (
          <Card variant="outlined" padding="md" style={styles.driverCard}>
            <View style={styles.driverRow}>
              <Avatar name={order.driver.name} url={order.driver.avatarUrl} size={50} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="headline" color={colors.text.primary} weight="700">
                    {order.driver.name}
                  </Text>
                  {order.driver.verified && (
                    <ShieldCheck size={16} color={colors.semantic.success} style={{ marginLeft: 4 }} />
                  )}
                </View>
                <Text variant="caption" color={colors.text.secondary}>
                  Kendaraan: {order.driver.vehicle?.plate || 'Motor'} ({order.driver.vehicle?.type || 'motor'})
                </Text>
                <Text variant="caption" color={colors.primary} weight="600">
                  Rating: {order.driver.ratingAvg?.toFixed(1) || '5.0'} ★ ({order.driver.deliveriesCount}x antar)
                </Text>
              </View>
            </View>

            <Divider style={{ marginVertical: spacing.sm }} />

            <View style={styles.driverActions}>
              <Button
                label="Kirim Pesan"
                variant="outline"
                size="sm"
                leftIcon={<MessageSquare size={16} color={colors.primary} />}
                onPress={() => router.push({ pathname: '/chat/[orderId]', params: { orderId: order.id } })}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : (
          <Card variant="flat" padding="md" style={styles.waitingDriverCard}>
            <Text variant="headline" color={colors.text.primary} weight="600">
              Menunggu Konfirmasi Driver
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2 }}>
              Permintaan telah diteruskan ke pengemudi searah. Anda akan diberitahu begitu pengemudi menerima.
            </Text>
          </Card>
        )}

        {/* Rute & Penerima */}
        <Card variant="outlined" padding="md" style={styles.sectionCard}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginBottom: spacing.sm }}>
            Rincian Alamat
          </Text>
          <View style={styles.addressRow}>
            <MapPin size={18} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="caption" color={colors.text.muted}>
                Penjemputan
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary}>
                {order.pickup.label}
              </Text>
            </View>
          </View>
          <Divider style={{ marginVertical: spacing.sm }} />
          <View style={styles.addressRow}>
            <MapPin size={18} color={colors.semantic.success} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="caption" color={colors.text.muted}>
                Tujuan (Penerima: {order.recipient.name} - {order.recipient.phone})
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary}>
                {order.dropoff.label}
              </Text>
            </View>
          </View>
        </Card>

        {/* Rincian Biaya */}
        {order.price && (
          <Card variant="outlined" padding="md" style={styles.sectionCard}>
            <PriceRow fee={order.price.fee} serviceFee={order.price.serviceFee} total={order.price.total} />
          </Card>
        )}

        {/* Timeline Log */}
        {order.timeline && order.timeline.length > 0 && (
          <Card variant="flat" padding="md" style={styles.sectionCard}>
            <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginBottom: spacing.sm }}>
              Riwayat Aktivitas
            </Text>
            {order.timeline.map((log, index) => (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text variant="calloutSemibold" color={colors.text.primary}>
                    {log.note || log.status}
                  </Text>
                  <Text variant="caption" color={colors.text.muted}>
                    {formatDateTime(log.at)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Actions based on state */}
        {isCompleted ? (
          <Button
            label="Beri Rating Driver (X3)"
            variant="primary"
            size="lg"
            leftIcon={<Star size={18} color="#FFF" />}
            onPress={() => router.push({ pathname: '/rating/[orderId]', params: { orderId: order.id } })}
            style={styles.actionBtn}
          />
        ) : canCancel ? (
          <Button
            label="Batalkan Pesanan (S7)"
            variant="ghost"
            size="md"
            onPress={() => router.push({ pathname: '/kirim/batal/[id]', params: { id: order.id } })}
            style={styles.cancelBtn}
          />
        ) : null}
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
  statusCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  codeCard: {
    marginBottom: spacing.md,
  },
  mapSection: {
    marginBottom: spacing.md,
  },
  driverCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  waitingDriverCard: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  actionBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  cancelBtn: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
});
