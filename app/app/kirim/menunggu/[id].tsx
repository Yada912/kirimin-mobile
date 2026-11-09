import React, { useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, CheckCircle } from 'lucide-react-native';
import { colors, radii, spacing } from '../../../src/theme/tokens';
import { Text, TopBar, Card, Button, StatusPill, SkeletonCard, ErrorState } from '../../../src/ui';
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
        <TopBar title="Permintaan Terbuka" />
        <View style={styles.content}>
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Permintaan Terbuka" />
        <ErrorState message={(error as any)?.message || 'Pesanan tidak ditemukan'} onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Menunggu Driver (S6)" />

      <View style={styles.content}>
        <Card variant="elevated" padding="xl" style={styles.card}>
          <View style={styles.iconCircle}>
            <Clock size={36} color={colors.primary} />
          </View>

          <Text variant="title" color={colors.text.primary} weight="700" align="center" style={styles.title}>
            Mencari Pengemudi Searah
          </Text>

          <StatusPill status={order.status} style={{ alignSelf: 'center', marginBottom: spacing.md }} />

          <Text variant="callout" color={colors.text.secondary} align="center" style={styles.desc}>
            Permintaan pesanan {order.code} telah dipublikasikan ke jaringan pengemudi Kirimin di rute:
          </Text>

          <View style={styles.routeBox}>
            <Text variant="calloutSemibold" color={colors.text.primary} align="center">
              {order.pickup.label}
            </Text>
            <Text variant="caption" color={colors.text.muted} align="center">
              menuju
            </Text>
            <Text variant="calloutSemibold" color={colors.text.primary} align="center">
              {order.dropoff.label}
            </Text>
          </View>

          <View style={styles.indicatorRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text variant="caption" color={colors.primary} style={{ marginLeft: 8 }}>
              Menunggu respon driver...
            </Text>
          </View>
        </Card>

        <View style={styles.actionRow}>
          <Button
            label="Buka Lacak Pesanan"
            variant="secondary"
            size="lg"
            onPress={() => router.push({ pathname: '/kirim/lacak/[id]', params: { id: order.id } })}
            style={{ marginBottom: spacing.sm }}
          />
          <Button
            label="Batalkan Permintaan"
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
