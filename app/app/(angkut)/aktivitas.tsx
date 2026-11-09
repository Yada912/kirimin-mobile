import React, { useState } from 'react';
import { StyleSheet, View, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PackageCheck } from 'lucide-react-native';
import { colors, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  SegmentedControl,
  Card,
  StatusPill,
  SkeletonCard,
  EmptyState,
  ErrorState,
} from '../../src/ui';
import { useOrders } from '../../src/api/hooks/useApi';
import { formatRupiah, formatDateTime } from '../../src/utils/format';

export default function AngkutAktivitasScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const {
    data: orders,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useOrders('driver', tab);

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Kiriman yang Diangkut" canGoBack={false} />

      <View style={styles.filterBar}>
        <SegmentedControl<'active' | 'history'>
          options={[
            { value: 'active', label: 'Paket Berjalan' },
            { value: 'history', label: 'Riwayat Selesai' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {isLoading ? (
        <View style={styles.listPadding}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <ErrorState
          message={(error as any)?.message || 'Gagal memuat daftar kiriman driver.'}
          onRetry={() => refetch()}
        />
      ) : !orders || orders.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'Tidak Ada Paket Aktif' : 'Belum Ada Riwayat Selesai'}
          description={
            tab === 'active'
              ? 'Terima permintaan kiriman pada rute Anda untuk mulai mengangkut paket.'
              : 'Semua paket yang telah Anda serahkan akan tercatat di sini.'
          }
          icon={<PackageCheck size={44} color={colors.text.muted} />}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <Card
              onPress={() => {
                if (item.tripId) {
                  router.push({ pathname: '/angkut/jalan/[tripId]', params: { tripId: item.tripId } });
                } else {
                  router.push({ pathname: '/angkut/detail-permintaan/[id]', params: { id: item.id } });
                }
              }}
              style={styles.orderCard}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text variant="headline" color={colors.text.primary} weight="700">
                    {item.code}
                  </Text>
                  <Text variant="caption" color={colors.text.muted}>
                    Pengirim: {item.sender.name}
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </View>

              <View style={styles.routeContainer}>
                <Text variant="calloutSemibold" color={colors.text.primary}>
                  {item.pickup.label} → {item.dropoff.label}
                </Text>
                <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2 }}>
                  Penerima: {item.recipient.name} ({item.recipient.phone})
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text variant="callout" color={colors.text.secondary}>
                  Ukuran: <Text variant="calloutSemibold">{item.size}</Text>
                </Text>
                <View style={styles.earningRow}>
                  <Text variant="caption" color={colors.text.muted}>
                    Pendapatan:
                  </Text>
                  <Text variant="headline" color={colors.semantic.success} weight="700" style={{ marginLeft: 4 }}>
                    {formatRupiah(item.price?.fee)}
                  </Text>
                </View>
              </View>
            </Card>
          )}
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
  filterBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  listPadding: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  orderCard: {
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  routeContainer: {
    marginVertical: spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  earningRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
