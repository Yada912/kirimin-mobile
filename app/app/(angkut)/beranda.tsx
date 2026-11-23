import React from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Navigation,
  Plus,
  ArrowRight,
  Wallet,
  Star,
  Repeat,
  SlidersHorizontal,
  Bookmark,
  MapPin,
  Sparkles,
} from 'lucide-react-native';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import {
  Text,
  Card,
  StatusPill,
  SkeletonCard,
  Avatar,
  DriverRouteArt,
  BrandLogo,
} from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';
import { useTripsMine, useStats, useSavedPlaces } from '../../src/api/hooks/useApi';
import { formatRupiah, formatTime } from '../../src/utils/format';
import { useRoutePresets, getPresetBg } from '../../src/features/presets/useRoutePresets';

export default function AngkutBerandaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: trips, isLoading: tripsLoading } = useTripsMine('active');
  const { data: stats } = useStats();
  const { data: savedPlaces = [] } = useSavedPlaces();
  const { presets } = useRoutePresets();

  const activeTrip = trips && trips.length > 0 ? trips[0] : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Compact Uber-style Driver Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(angkut)/profil')} style={styles.userRow}>
            <Avatar name={user?.name || 'Driver'} url={user?.avatarUrl} size={40} />
            <View style={styles.userInfo}>
              <BrandLogo size="sm" variant="dark" />
              <Text variant="captionMedium" color={colors.text.secondary} style={{ marginTop: 1 }}>
                {user?.name || 'Driver'} • {user?.vehicle?.plate || 'Siap Jalan'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/pilih-peran')}
            style={styles.roleSwitch}
          >
            <Repeat size={13} color={colors.driver} />
            <Text variant="captionMedium" color={colors.driver} weight="700" style={{ marginLeft: 4 }}>
              Angkut
            </Text>
          </Pressable>
        </View>

        {/* Active Trip Live Card (1-tap jump straight into live road navigation) */}
        {tripsLoading ? (
          <SkeletonCard />
        ) : activeTrip ? (
          <Pressable
            onPress={() => {
              if (activeTrip.status === 'ongoing') {
                router.push({ pathname: '/angkut/jalan/[tripId]', params: { tripId: activeTrip.id } });
              } else {
                router.push({ pathname: '/angkut/permintaan/[tripId]', params: { tripId: activeTrip.id } });
              }
            }}
            style={styles.activeTripBanner}
          >
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <View style={styles.activeTripTop}>
                <View style={styles.tripTag}>
                  <Navigation size={12} color={colors.driverDeep} />
                  <Text variant="captionMedium" color={colors.driverDeep} weight="700" style={{ marginLeft: 4 }}>
                    {activeTrip.name}
                  </Text>
                </View>
                <StatusPill status={activeTrip.status} />
              </View>
              <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1} style={{ marginTop: 4 }}>
                {activeTrip.origin.label} → {activeTrip.destination.label}
              </Text>
              <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2 }}>
                {formatTime(activeTrip.departAt)} • {activeTrip.slotsUsed}/{activeTrip.maxPackages} slot terisi
              </Text>
            </View>
            <View style={styles.openNavPill}>
              <Text variant="captionMedium" color="#FFFFFF" weight="700">
                {activeTrip.status === 'ongoing' ? 'Navigasi' : 'Buka'}
              </Text>
              <ArrowRight size={13} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          </Pressable>
        ) : null}

        {/* LARGE EMERALD DRIVER HERO BANNER (Playful Map Art + 1-Tap Publish above the fold!) */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <View style={styles.heroPill}>
                <Sparkles size={11} color="#FDE047" />
                <Text variant="caption" color="#FDE047" weight="700" style={{ marginLeft: 4, fontSize: 10 }}>
                  CUAN DI RUTE HARIAN
                </Text>
              </View>
              <Text variant="title" color="#FFFFFF" weight="700" style={styles.heroHeading}>
                Buka Rute & Angkut Paket
              </Text>
              <Text variant="caption" color="#D1FAE5" style={styles.heroSub}>
                Navigasi jalan pintar + ongkos langsung masuk saldo.
              </Text>
            </View>
            <DriverRouteArt width={116} height={94} />
          </View>

          <Pressable
            onPress={() => router.push('/angkut/buat-rute')}
            style={({ pressed }) => [styles.heroPrimaryBtn, pressed && { opacity: 0.9 }]}
            testID="buat-rute-cta"
          >
            <Plus size={18} color={colors.driverDeep} />
            <Text variant="headline" color={colors.driverDeep} weight="700" style={{ marginLeft: 6 }}>
              Publikasikan Rute Baru
            </Text>
          </Pressable>
        </View>

        {/* ABOVE-THE-FOLD STATS & QUICK CUSTOMIZE STRIP */}
        <View style={styles.statsRow}>
          <Card variant="flat" padding="md" style={styles.statCardGreen}>
            <View style={styles.statHeader}>
              <Wallet size={16} color={colors.driver} />
              <Text variant="captionMedium" color={colors.driverDeep} weight="600">
                Penghasilan
              </Text>
            </View>
            <Text variant="title" color={colors.text.primary} weight="700" style={{ marginTop: 4 }}>
              {formatRupiah(stats?.driver?.earningsTotal ?? 48000)}
            </Text>
            <Text variant="caption" color={colors.text.secondary}>
              {user?.deliveriesCount ?? 0}x paket diantar
            </Text>
          </Card>

          <Card variant="flat" padding="md" style={styles.statCardAmber}>
            <View style={styles.statHeader}>
              <Star size={16} color={colors.accent.amber} />
              <Text variant="captionMedium" color="#92400E" weight="600">
                Reputasi Driver
              </Text>
            </View>
            <Text variant="title" color={colors.text.primary} weight="700" style={{ marginTop: 4 }}>
              {user?.ratingAvg ? user.ratingAvg.toFixed(1) : '5.0'} ★
            </Text>
            <Text variant="caption" color={colors.text.secondary}>
              {user?.ratingCount ?? 0} ulasan pengirim
            </Text>
          </Card>
        </View>

        {/* Quick Customization Tools (Thumb-reach) */}
        <View style={styles.toolsRow}>
          <Pressable onPress={() => router.push('/kelola/preset')} style={styles.toolChip}>
            <SlidersHorizontal size={14} color={colors.accent.coral} />
            <Text variant="captionMedium" color={colors.text.primary} weight="700" style={{ marginLeft: 5 }}>
              Edit Preset ({presets.length})
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push('/kelola/lokasi')} style={styles.toolChip}>
            <Bookmark size={14} color={colors.accent.violet} />
            <Text variant="captionMedium" color={colors.text.primary} weight="700" style={{ marginLeft: 5 }}>
              Lokasi ({savedPlaces.length})
            </Text>
          </Pressable>
        </View>

        {/* BELOW THE FOLD: Quick-Publish Commute Presets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="headline" color={colors.text.primary} weight="700">
              Terbitkan dari Preset Rute
            </Text>
            <Pressable onPress={() => router.push('/kelola/preset')}>
              <Text variant="captionMedium" color={colors.driver} weight="700">
                Kelola
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetCarousel}
          >
            {presets.map((preset) => {
              const accent = preset.color || colors.driver;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() =>
                    router.push({
                      pathname: '/angkut/buat-rute',
                      params: {
                        namePreset: preset.name,
                        originJson: JSON.stringify(preset.pickup),
                        destinationJson: JSON.stringify(preset.dropoff),
                      },
                    })
                  }
                  style={[styles.presetCard, { borderLeftColor: accent }]}
                >
                  <View style={[styles.presetIcon, { backgroundColor: getPresetBg(accent) }]}>
                    <MapPin size={14} color={accent} />
                  </View>
                  <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1} style={{ marginTop: 6 }}>
                    {preset.name}
                  </Text>
                  <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
                    {preset.pickup.label} → {preset.dropoff.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
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
    padding: spacing.md,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: spacing.sm,
  },
  roleSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.driverSubtle,
    borderWidth: 1,
    borderColor: colors.driverLight,
  },
  activeTripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.driverSubtle,
    borderWidth: 1,
    borderColor: colors.driverLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.driver,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  activeTripTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  tripTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openNavPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.driver,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  heroBanner: {
    backgroundColor: colors.driver,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.float,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroCopy: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
    marginBottom: 6,
  },
  heroHeading: {
    fontSize: 21,
    lineHeight: 26,
  },
  heroSub: {
    marginTop: 4,
    lineHeight: 17,
  },
  heroPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    height: 48,
    borderRadius: radii.md,
    ...shadows.card,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCardGreen: {
    flex: 1,
    backgroundColor: colors.driverSubtle,
    borderWidth: 1,
    borderColor: colors.driverLight,
  },
  statCardAmber: {
    flex: 1,
    backgroundColor: colors.accent.amberLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  toolChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 10,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  presetCarousel: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  presetCard: {
    width: 204,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderLeftWidth: 4,
    ...shadows.card,
  },
  presetIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
