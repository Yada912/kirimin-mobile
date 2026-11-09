import React, { useState } from 'react';
import { StyleSheet, View, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, ArrowRight } from 'lucide-react-native';
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

export default function KirimAktivitasScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const {
    data: orders,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useOrders('sender', tab);

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Aktivitas Kiriman" canGoBack={false} />

      <View style={styles.filterBar}>
        <SegmentedControl<'active' | 'history'>
          options={[
            { value: 'active', label: 'Sedang Berjalan' },
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
          <SkeletonCard />
        </View>
      ) : isError ? (
        <ErrorState
          message={(error as any)?.message || 'Gagal memuat daftar kiriman.'}
          onRetry={() => refetch()}
        />
      ) : !orders || orders.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'Tidak Ada Kiriman Berjalan' : 'Belum Ada Riwayat'}
          description={
            tab === 'active'
              ? 'Anda belum memiliki paket yang sedang dikirim saat ini.'
              : 'Semua paket yang telah selesai atau dibatalkan akan muncul di sini.'
          }
          actionLabel={tab === 'active' ? 'Kirim Paket Sekarang' : undefined}
          onAction={() => router.push('/kirim/paket')}
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
              onPress={() => router.push({ pathname: '/kirim/lacak/[id]', params: { id: item.id } })}
              style={styles.orderCard}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text variant="headline" color={colors.text.primary} weight="700">
                    {item.code}
                  </Text>
                  <Text variant="caption" color={colors.text.muted}>
                    {formatDateTime(item.createdAt)}
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </View>

              <View style={styles.routeContainer}>
                <View style={styles.routeRow}>
                  <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                    {item.pickup.label}
                  </Text>
                  <Text variant="callout" color={colors.text.muted} style={{ marginHorizontal: 6 }}>
                    →
                  </Text>
                  <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                    {item.dropoff.label}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text variant="callout" color={colors.text.secondary}>
                  Ukuran: <Text variant="calloutSemibold">{item.size}</Text>
                  {item.driver ? ` • Driver: ${item.driver.name}` : ' • Menunggu Driver'}
                </Text>
                <Text variant="headline" color={colors.primary} weight="700">
                  {formatRupiah(item.price?.total)}
                </Text>
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
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
