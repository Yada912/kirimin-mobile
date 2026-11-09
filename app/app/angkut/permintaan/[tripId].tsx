import React from 'react';
import { StyleSheet, View, FlatList, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Inbox, ArrowRight, Play, Check, X } from 'lucide-react-native';
import type { IncomingRequest } from '@kirimin/shared';
import { colors, radii, spacing } from '../../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Avatar,
  Button,
  StatusPill,
  SkeletonCard,
  EmptyState,
  ErrorState,
} from '../../../src/ui';
import { useTrip, useTripRequests, useAcceptOrder, useDeclineOrder } from '../../../src/api/hooks/useApi';
import { formatRupiah, formatDetour } from '../../../src/utils/format';

export default function AngkutPermintaanScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const { data: trip } = useTrip(tripId);
  const {
    data: requests,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useTripRequests(tripId);

  const { mutateAsync: acceptOrder, isPending: isAccepting } = useAcceptOrder();
  const { mutateAsync: declineOrder, isPending: isDeclining } = useDeclineOrder();

  const handleQuickAccept = async (orderId: string) => {
    try {
      await acceptOrder({ orderId, tripId });
      refetch();
    } catch (err: any) {
      alert(err.message || 'Gagal menerima pesanan');
    }
  };

  const handleQuickDecline = async (orderId: string) => {
    try {
      await declineOrder({ orderId, reason: 'Rute penuh atau tidak sempat' });
      refetch();
    } catch (err: any) {
      alert(err.message || 'Gagal menolak pesanan');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar
        title={trip?.name ? `Permintaan: ${trip.name}` : 'Permintaan Masuk (D3)'}
        rightAction={
          trip?.slotsUsed && trip.slotsUsed > 0 ? (
            <Button
              label="Perjalanan"
              variant="primary"
              size="sm"
              leftIcon={<Play size={14} color="#FFF" />}
              onPress={() => router.push({ pathname: '/angkut/jalan/[tripId]', params: { tripId } })}
            />
          ) : undefined
        }
      />

      {isLoading ? (
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <ErrorState
          message={(error as any)?.message || 'Gagal memuat permintaan masuk.'}
          onRetry={() => refetch()}
        />
      ) : !requests || requests.length === 0 ? (
        <EmptyState
          title="Belum Ada Permintaan Masuk"
          description="Pengirim yang memiliki rute searah dengan perjalanan Anda akan muncul di sini."
          icon={<Inbox size={48} color={colors.text.muted} />}
          actionLabel={trip?.slotsUsed ? 'Buka Perjalanan Aktif' : undefined}
          onAction={() => router.push({ pathname: '/angkut/jalan/[tripId]', params: { tripId } })}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.order.id}
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
          renderItem={({ item }) => {
            const isDirectRequest = item.source === 'requested';

            return (
              <Card
                onPress={() =>
                  router.push({
                    pathname: '/angkut/detail-permintaan/[id]',
                    params: { id: item.order.id, tripId },
                  })
                }
                style={styles.requestCard}
              >
                <View style={styles.headerRow}>
                  <View style={styles.senderInfo}>
                    <Avatar name={item.order.sender.name} url={item.order.sender.avatarUrl} size={42} />
                    <View style={{ marginLeft: spacing.sm }}>
                      <Text variant="headline" color={colors.text.primary} weight="700">
                        {item.order.sender.name}
                      </Text>
                      <Text variant="caption" color={colors.text.muted}>
                        Paket: {item.order.category} ({item.order.size})
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.sourceBadge,
                      {
                        backgroundColor: isDirectRequest ? colors.primaryLight : colors.semantic.warningLight,
                      },
                    ]}
                  >
                    <Text
                      variant="captionMedium"
                      color={isDirectRequest ? colors.primary : colors.semantic.warning}
                    >
                      {isDirectRequest ? 'Permintaan Khusus' : 'Rute Cocok'}
                    </Text>
                  </View>
                </View>

                {/* Route */}
                <View style={styles.routeBox}>
                  <Text variant="calloutSemibold" color={colors.text.primary}>
                    {item.order.pickup.label} → {item.order.dropoff.label}
                  </Text>
                  <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2 }}>
                    Simpangan: {formatDetour(item.detourKm, item.detourMinutes)}
                  </Text>
                </View>

                {/* Earnings & Actions */}
                <View style={styles.footerRow}>
                  <View>
                    <Text variant="caption" color={colors.text.muted}>
                      Kamu Dapat
                    </Text>
                    <Text variant="headline" color={colors.semantic.success} weight="700">
                      {formatRupiah(item.earning)}
                    </Text>
                  </View>

                  <View style={styles.btnRow}>
                    <Button
                      label="Tolak"
                      variant="ghost"
                      size="sm"
                      fullWidth={false}
                      loading={isDeclining}
                      onPress={() => handleQuickDecline(item.order.id)}
                      style={{ marginRight: spacing.xs }}
                    />
                    <Button
                      label="Terima"
                      variant="primary"
                      size="sm"
                      fullWidth={false}
                      loading={isAccepting}
                      onPress={() => handleQuickAccept(item.order.id)}
                    />
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
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
    gap: spacing.md,
  },
  requestCard: {
    backgroundColor: colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sourceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  routeBox: {
    marginVertical: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
