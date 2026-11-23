import React from 'react';
import { StyleSheet, View, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ORDER_STATUS_LABELS, TRACKING_STEPS } from '@kirimin/shared';
import type { OrderStatus } from '@kirimin/shared';
import { MapPin, Search, Repeat, ChevronRight, ShieldCheck, Package } from '../../src/ui/icons';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import { Text, SkeletonCard, Avatar, SearahScene } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';
import { useOrders } from '../../src/api/hooks/useApi';
import { useRoutePresets } from '../../src/features/presets/useRoutePresets';

/** 0..1 progress for the little bar on the active-order card. */
function progressOf(status: OrderStatus): number {
  const i = TRACKING_STEPS.indexOf(status);
  if (i >= 0) return (i + 1) / TRACKING_STEPS.length;
  return 0.08; // still looking for a driver
}

export default function KirimBerandaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { data: activeOrders, isLoading } = useOrders('sender', 'active');
  const { presets } = useRoutePresets();

  const activeOrder = activeOrders && activeOrders.length > 0 ? activeOrders[0] : null;
  const firstName = (user?.name || 'kamu').split(' ')[0];

  const startSend = (preset?: (typeof presets)[number]) => {
    router.push(
      preset
        ? {
            pathname: '/kirim/rute',
            params: {
              pickupJson: JSON.stringify(preset.pickup),
              dropoffJson: JSON.stringify(preset.dropoff),
              categoryPreset: preset.defaultCategory || '',
              sizePreset: preset.defaultSize || '',
            },
          }
        : '/kirim/rute',
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(kirim)/profil')} style={styles.userRow} hitSlop={6}>
            <Avatar name={user?.name || 'Pengirim'} url={user?.avatarUrl} size={40} />
            <Text variant="title" color={colors.laut} style={{ marginLeft: spacing.sm }}>
              Halo, {firstName}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(auth)/pilih-peran')} style={styles.roleSwitch} hitSlop={6}>
            <Repeat size={14} color={colors.primary} />
            <Text variant="captionMedium" color={colors.primary} weight="700" style={{ marginLeft: 6 }}>
              Ganti ke pengemudi
            </Text>
          </Pressable>
        </View>

        {/* One job on this screen: start a delivery. */}
        <View style={styles.hero}>
          <View style={StyleSheet.absoluteFill}>
            <SearahScene width={width - spacing.lg * 2} height={210} />
          </View>
          <View style={styles.heroInner}>
            <Text variant="largeTitle" color="#FFFFFF">
              Mau kirim ke mana?
            </Text>
            <Text variant="callout" color={colors.langit} style={{ marginTop: 4 }}>
              Kami carikan pengendara yang sudah lewat sana.
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => startSend()}
          style={({ pressed }) => [styles.searchField, pressed && { transform: [{ scale: 0.99 }] }]}
          testID="kirim-paket-cta"
          accessibilityRole="button"
        >
          <Search size={20} color={colors.primary} />
          <Text variant="bodyMedium" color={colors.text.secondary} style={{ marginLeft: spacing.sm, flex: 1 }}>
            Cari tujuan pengiriman
          </Text>
          <View style={styles.searchGo}>
            <ChevronRight size={18} color="#FFFFFF" />
          </View>
        </Pressable>

        {isLoading ? (
          <SkeletonCard />
        ) : activeOrder ? (
          <Pressable
            onPress={() => router.push({ pathname: '/kirim/lacak/[id]', params: { id: activeOrder.id } })}
            style={({ pressed }) => [styles.activeCard, pressed && { opacity: 0.92 }]}
            testID="active-order-card"
          >
            <View style={styles.activeTop}>
              <View style={styles.activeIcon}>
                <Package size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text variant="headline" numberOfLines={1}>
                  {activeOrder.pickup.label} ke {activeOrder.dropoff.label}
                </Text>
                <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2 }}>
                  {ORDER_STATUS_LABELS[activeOrder.status]}
                </Text>
              </View>
              <Text variant="calloutSemibold" color={colors.primary}>
                Lacak
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progressOf(activeOrder.status) * 100)}%` }]} />
            </View>
          </Pressable>
        ) : null}

        {presets.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text variant="headline">Kirim lagi</Text>
              <Pressable onPress={() => router.push('/kelola/preset')} hitSlop={8}>
                <Text variant="calloutSemibold" color={colors.primary}>
                  Atur
                </Text>
              </Pressable>
            </View>
            <View style={styles.list}>
              {presets.slice(0, 3).map((preset, i) => (
                <Pressable
                  key={preset.id}
                  onPress={() => startSend(preset)}
                  style={({ pressed }) => [styles.listRow, i > 0 && styles.listDivider, pressed && { backgroundColor: colors.surfaceSecondary }]}
                >
                  <View style={[styles.pinTile, { backgroundColor: (preset.color || colors.primary) + '1F' }]}>
                    <MapPin size={20} color={preset.color || colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text variant="calloutSemibold" numberOfLines={1}>
                      {preset.dropoff.label}
                    </Text>
                    <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
                      dari {preset.pickup.label}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.text.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.safetyBanner}>
          <View style={styles.safetyIcon}>
            <ShieldCheck size={28} color={colors.laut} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text variant="headline" color={colors.laut}>
              Paket hanya pindah tangan dengan kode
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2 }}>
              Penerima menyebutkan 4 digit ke pengemudi saat paket diserahkan.
            </Text>
          </View>
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
  },
  hero: {
    height: 210,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.laut,
    padding: spacing.lg,
  },
  heroInner: {
    maxWidth: 260,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    height: 58,
    marginTop: -29,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.float,
  },
  searchGo: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.langit,
  },
  activeTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  listDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pinTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.kunyitLight,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  safetyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.kunyit,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
