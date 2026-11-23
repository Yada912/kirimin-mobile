import React from 'react';
import { StyleSheet, View, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MessageSquare,
  ShieldCheck,
  MapPin,
  Star,
  CreditCard,
  Radio,
} from '../../../src/ui/icons';
import { colors, radii, spacing, shadows } from '../../../src/theme/tokens';
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
import { formatDateTime } from '../../../src/utils/format';
import { ORDER_STATUS_LABELS } from '@kirimin/shared';

export default function LacakPesananScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isError, error, refetch, isRefetching } = useOrder(id);
  const { height: screenH } = useWindowDimensions();
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
  const mapHeight = Math.round(Math.max(300, Math.min(480, screenH * 0.5)));
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
              fullWidth={false}
              leftIcon={<MessageSquare size={15} color={colors.primary} />}
              onPress={() => router.push({ pathname: '/chat/[orderId]', params: { orderId: order.id } })}
            />
          ) : (
            <StatusPill status={order.status} />
          )
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
        {/* TOP HERO: Live Road-Following Interactive Map (Gojek / Uber style) */}
        <View style={styles.mapSection}>
          <MapView
            pickup={order.pickup}
            dropoff={order.dropoff}
            stops={trip?.stops || []}
            driverLocation={driverGps}
            height={mapHeight}
            showSettings
            navigationMode={!!driverGps && !isCompleted && !isCancelled}
            allowExpand
            style={styles.mapHero}
          />
          {driverGps && !isCompleted && !isCancelled ? (
            <View style={styles.liveTrackPill}>
              <Radio size={13} color={colors.driver} />
              <Text variant="captionMedium" color={colors.driverDeep} weight="700" style={{ marginLeft: 5 }}>
                Pengemudi sedang di jalan
              </Text>
            </View>
          ) : null}
        </View>

        {/* ABOVE THE FOLD: Status + 5-Step Progress + Quick Primary CTA */}
        <Card variant="elevated" padding="md" style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text variant="title" color={colors.laut}>
                {ORDER_STATUS_LABELS[order.status]}
              </Text>
              <Text variant="callout" color={colors.text.secondary} numberOfLines={1}>
                {order.pickup.label} ke {order.dropoff.label}
              </Text>
            </View>
          </View>

          <ProgressSteps currentStatus={order.status} style={{ marginVertical: spacing.xs }} />

          {/* Quick Action Strip right above the fold */}
          <View style={styles.quickBtnRow}>
            {isCompleted ? (
              <Button
                label="Beri nilai pengemudi"
                variant="primary"
                size="md"
                leftIcon={<Star size={16} color="#FFF" />}
                onPress={() => router.push({ pathname: '/rating/[orderId]', params: { orderId: order.id } })}
                style={{ flex: 1 }}
              />
            ) : (
              <>
                {order.driver ? (
                  <Button
                    label="Chat pengemudi"
                    variant="primary"
                    size="md"
                    leftIcon={<MessageSquare size={16} color="#FFF" />}
                    onPress={() => router.push({ pathname: '/chat/[orderId]', params: { orderId: order.id } })}
                    style={{ flex: 1 }}
                  />
                ) : null}
                {order.payment?.status === 'unpaid' && !isCancelled ? (
                  <Button
                    label="Bayar"
                    variant="outline"
                    size="md"
                    leftIcon={<CreditCard size={15} color={colors.primary} />}
                    onPress={() => router.push({ pathname: '/bayar/[orderId]', params: { orderId: order.id } })}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </>
            )}
          </View>
        </Card>

        {/* 4-Digit Handover Code (Visible right away) */}
        {order.handoverCode && !isCompleted && !isCancelled && (
          <CodeDisplay
            code={order.handoverCode}
            testID="handover-code-display"
            label="Kode serah terima"
            hint="Bagikan ke penerima. Pengemudi meminta kode ini saat menyerahkan paket."
            style={styles.codeCard}
          />
        )}

        {/* BELOW THE FOLD: Driver Card */}
        {order.driver ? (
          <Card variant="outlined" padding="md" style={styles.driverCard}>
            <View style={styles.driverRow}>
              <Avatar name={order.driver.name} url={order.driver.avatarUrl} size={48} />
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
                  ★ {order.driver.ratingAvg?.toFixed(1) || '5.0'}  ({order.driver.deliveriesCount}x antar)  {order.driver.vehicle?.plate || ''}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card variant="flat" padding="md" style={styles.waitingDriverCard}>
            <Text variant="headline" color={colors.text.primary} weight="600">
              Belum ada pengemudi
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2 }}>
              Kami kabari begitu ada pengemudi yang menerima paketmu.
            </Text>
          </Card>
        )}

        {/* Rute & Penerima */}
        <Card variant="outlined" padding="md" style={styles.sectionCard}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginBottom: spacing.sm }}>
            Alamat
          </Text>
          <View style={styles.addressRow}>
            <MapPin size={18} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="caption" color={colors.text.muted}>
                Jemput di
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary}>
                {order.pickup.label}
              </Text>
            </View>
          </View>
          <Divider style={{ marginVertical: spacing.sm }} />
          <View style={styles.addressRow}>
            <MapPin size={18} color={colors.senja} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="caption" color={colors.text.muted}>
                Antar ke {order.recipient.name} ({order.recipient.phone})
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
              Riwayat
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

        {canCancel ? (
          <Button
            label="Batalkan pesanan"
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
    padding: spacing.md,
    paddingBottom: 40,
  },
  mapSection: {
    marginHorizontal: -spacing.md,
    marginTop: -spacing.md,
  },
  mapHero: {
    borderRadius: 0,
    borderWidth: 0,
  },
  liveTrackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.driverSubtle,
    borderWidth: 1,
    borderColor: colors.driverLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginTop: spacing.xs,
  },
  statusCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    marginTop: -28,
    borderRadius: radii.xl,
    ...shadows.float,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quickBtnRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  codeCard: {
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
  cancelBtn: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
});
