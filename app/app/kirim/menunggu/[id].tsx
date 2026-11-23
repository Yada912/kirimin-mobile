import React, { useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, CheckCircle } from '../../../src/ui/icons';
import { colors, radii, spacing } from '../../../src/theme/tokens';
import { Text, TopBar, Card, Button, SkeletonCard, ErrorState, SearchingArt, Pulse } from '../../../src/ui';
import { useOrder } from '../../../src/api/hooks/useApi';

export default function KirimMenungguScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isError, error, refetch } = useOrder(id);

  // If driver has accepted or status changed, redirect to lacak
  useEffect(() => {
    if (order && order.status !== 'open') {
      router.replace({ pathname: '/kirim/lacak/[id]', params: { id: order.id } });
    }
  }, [order, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Menunggu pengemudi" />
        <View style={styles.content}>
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Menunggu pengemudi" />
        <ErrorState message={(error as any)?.message || 'Pesanan tidak ditemukan'} onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Menunggu pengemudi" />

      <View style={styles.content}>
        <Card variant="elevated" padding="xl" style={styles.card}>
          <View style={styles.searching}>
            <Pulse size={170} color={colors.primary} />
            <SearchingArt size={140} />
          </View>

          <Text variant="title" color={colors.text.primary} weight="700" align="center" style={styles.title}>
            Mencari pengemudi yang searah
          </Text>

          <Text variant="callout" color={colors.text.secondary} align="center" style={styles.desc}>
            Semua pengemudi yang lewat rute ini sudah kami kabari.
          </Text>

          <View style={styles.routeBox}>
            <Text variant="calloutSemibold" color={colors.text.primary} align="center">
              {order.pickup.label}
            </Text>
            <Text variant="caption" color={colors.text.muted} align="center">
              ke
            </Text>
            <Text variant="calloutSemibold" color={colors.text.primary} align="center">
              {order.dropoff.label}
            </Text>
          </View>

          <View style={styles.indicatorRow}>
            <Text variant="caption" color={colors.primary}>
              Biasanya kurang dari 10 menit
            </Text>
          </View>
        </Card>

        <View style={styles.actionRow}>
          <Button
            label="Lihat pesanan"
            variant="secondary"
            size="lg"
            onPress={() => router.push({ pathname: '/kirim/lacak/[id]', params: { id: order.id } })}
            style={{ marginBottom: spacing.sm }}
          />
          <Button
            label="Batalkan"
            variant="ghost"
            size="md"
            onPress={() => router.push({ pathname: '/kirim/batal/[id]', params: { id: order.id } })}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginTop: spacing.xl,
  },
  searching: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.xs,
  },
  desc: {
    marginBottom: spacing.md,
  },
  routeBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.md,
    width: '100%',
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  actionRow: {
    marginBottom: spacing.md,
  },
});

