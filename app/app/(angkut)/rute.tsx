import React, { useState } from 'react';
import { StyleSheet, View, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, Plus } from 'lucide-react-native';
import { colors, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  SegmentedControl,
  Card,
  StatusPill,
  Button,
  SkeletonCard,
  EmptyState,
  ErrorState,
} from '../../src/ui';
import { useTripsMine } from '../../src/api/hooks/useApi';
import { formatTime, formatDate } from '../../src/utils/format';

export default function AngkutRuteScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const {
    data: trips,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useTripsMine(tab);

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar
        title="Rute Saya"
        canGoBack={false}
        rightAction={
          <Button
            label="Tambah"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/angkut/buat-rute')}
          />
        }
      />

      <View style={styles.filterBar}>
        <SegmentedControl<'active' | 'history'>
          options={[
            { value: 'active', label: 'Rute Terjadwal & Aktif' },
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
          message={(error as any)?.message || 'Gagal memuat rute.'}
          onRetry={() => refetch()}
        />
      ) : !trips || trips.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'Belum Ada Rute Aktif' : 'Belum Ada Riwayat Rute'}
          description={
            tab === 'active'
              ? 'Publikasikan rute perjalanan rutin Anda untuk menerima permintaan titipan paket.'
              : 'Semua rute yang telah diselesaikan akan tercatat di sini.'
          }
          actionLabel={tab === 'active' ? 'Buat Rute Sekarang' : undefined}
          onAction={() => router.push('/angkut/buat-rute')}
          icon={<Navigation size={44} color={colors.text.muted} />}
        />
      ) : (
        <FlatList
          data={trips}
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
                if (item.status === 'ongoing') {
                  router.push({ pathname: '/angkut/jalan/[tripId]', params: { tripId: item.id } });
                } else {
                  router.push({ pathname: '/angkut/permintaan/[tripId]', params: { tripId: item.id } });
                }
              }}
              style={styles.tripCard}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text variant="headline" color={colors.text.primary} weight="700">
                    {item.name}
                  </Text>
                  <Text variant="caption" color={colors.text.muted}>
                    {formatDate(item.departAt)} • {formatTime(item.departAt)}
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </View>

              <View style={styles.routeContainer}>
                <Text variant="calloutSemibold" color={colors.text.primary}>
                  {item.origin.label} → {item.destination.label}
                </Text>
                {item.stops && item.stops.length > 0 && (
                  <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2 }}>
                    Lewat: {item.stops.map((s) => s.label).join(', ')}
                  </Text>
                )}
              </View>

              <View style={styles.cardFooter}>
                <Text variant="callout" color={colors.text.secondary}>
                  Kapasitas: <Text variant="calloutSemibold">{item.slotsUsed}/{item.maxPackages} paket</Text>
                </Text>
                <Text variant="callout" color={colors.primary} weight="600">
                  {item.status === 'ongoing' ? 'Buka Perjalanan →' : 'Lihat Permintaan →'}
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
  tripCard: {
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
});
