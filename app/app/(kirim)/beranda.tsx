import React from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  MapPin,
  ArrowRight,
  Clock,
  SlidersHorizontal,
  Bookmark,
  Package,
  Sparkles,
  Repeat,
} from 'lucide-react-native';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import {
  Text,
  Card,
  StatusPill,
  SkeletonCard,
  Avatar,
  CourierScooterArt,
  HandoverSparkArt,
  BrandLogo,
} from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';
import { useOrders, useSavedPlaces } from '../../src/api/hooks/useApi';
import { useRoutePresets, getPresetBg } from '../../src/features/presets/useRoutePresets';

export default function KirimBerandaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: activeOrders, isLoading } = useOrders('sender', 'active');
  const { data: savedPlaces = [] } = useSavedPlaces();
  const { presets } = useRoutePresets();

  const activeOrder = activeOrders && activeOrders.length > 0 ? activeOrders[0] : null;

  const launchPreset = (preset: (typeof presets)[number]) => {
    router.push({
      pathname: '/kirim/paket',
      params: {
        pickupPreset: preset.pickup.label,
        dropoffPreset: preset.dropoff.label,
        pickupJson: JSON.stringify(preset.pickup),
        dropoffJson: JSON.stringify(preset.dropoff),
        categoryPreset: preset.defaultCategory || '',
        sizePreset: preset.defaultSize || '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Compact Uber-style Brand + User Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push('/(kirim)/profil')}
            style={styles.userRow}
          >
            <Avatar name={user?.name || 'Pengirim'} url={user?.avatarUrl} size={40} />
            <View style={styles.userInfo}>
              <BrandLogo size="sm" tone="kirim" />
              <Text variant="captionMedium" color={colors.text.secondary} style={{ marginTop: 1 }}>
                Halo, {user?.name || 'Pengguna'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/pilih-peran')}
            style={styles.roleSwitch}
          >
            <Repeat size={13} color={colors.primary} />
            <Text variant="captionMedium" color={colors.primary} weight="700" style={{ marginLeft: 4 }}>
              Kirim
            </Text>
          </Pressable>
        </View>

        {/* Active Order Live Banner (if any) */}
        {isLoading ? (
          <SkeletonCard />
        ) : activeOrder ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/kirim/lacak/[id]', params: { id: activeOrder.id } })
            }
            style={styles.activeStrip}
          >
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <View style={styles.activeTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.activePulseDot} />
                  <Text variant="captionMedium" color={colors.primaryDeep} weight="700">
                    {activeOrder.code}
                  </Text>
                </View>
                <StatusPill status={activeOrder.status} />
              </View>
              <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1} style={{ marginTop: 4 }}>
                {activeOrder.pickup.label} → {activeOrder.dropoff.label}
              </Text>
            </View>
            <View style={styles.trackChip}>
              <Text variant="captionMedium" color="#FFFFFF" weight="700">
                Lacak
              </Text>
              <ArrowRight size={13} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          </Pressable>
        ) : null}

        {/* LARGE VIBRANT HERO BANNER (Playful Art + Main CTA above the fold!) */}
        <View style={styles.heroBanner}>
          <View style={styles.heroBannerTop}>
            <View style={styles.heroCopy}>
              <View style={styles.heroPill}>
                <Sparkles size={11} color="#FEF08A" />
                <Text variant="caption" color="#FEF08A" weight="700" style={{ marginLeft: 4, fontSize: 10 }}>
                  HEMAT & SEARAH BALI
                </Text>
              </View>
              <Text variant="title" color="#FFFFFF" weight="700" style={styles.heroHeading}>
                Titip Kirim Paket Cepat
              </Text>
              <Text variant="caption" color="#DBEAFE" style={styles.heroSub}>
                Temukan pengendara yang lewat rute tujuanmu sekarang.
              </Text>
            </View>
            <View style={styles.heroArtWrap}>
              <CourierScooterArt width={116} height={94} />
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/kirim/paket')}
            style={({ pressed }) => [styles.heroPrimaryBtn, pressed && { opacity: 0.9 }]}
            testID="kirim-paket-cta"
          >
            <Plus size={18} color={colors.primaryDeep} />
            <Text variant="headline" color={colors.primaryDeep} weight="700" style={{ marginLeft: 6 }}>
              Kirim Paket Sekarang
            </Text>
          </Pressable>
        </View>

        {/* ABOVE-THE-FOLD QUICK ACTIONS (Within thumb's reach — zero scrolling!) */}
        <View style={styles.quickGrid}>
          <Pressable
            onPress={() => router.push('/kelola/preset')}
            style={[styles.quickTile, { backgroundColor: colors.accent.amberLight, borderColor: '#FDE68A' }]}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.accent.coral }]}>
              <SlidersHorizontal size={16} color="#FFFFFF" />
            </View>
            <Text variant="captionMedium" color={colors.text.primary} weight="700">
              Atur Preset
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ fontSize: 10 }}>
              {presets.length} rute cepat
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/kelola/lokasi')}
            style={[styles.quickTile, { backgroundColor: colors.accent.violetLight, borderColor: '#DDD6FE' }]}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.accent.violet }]}>
              <Bookmark size={16} color="#FFFFFF" />
            </View>
            <Text variant="captionMedium" color={colors.text.primary} weight="700">
              Lokasi Saya
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ fontSize: 10 }}>
              {savedPlaces.length} tersimpan
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(kirim)/aktivitas')}
            style={[styles.quickTile, { backgroundColor: colors.driverSubtle, borderColor: colors.driverLight }]}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: colors.driver }]}>
              <Package size={16} color="#FFFFFF" />
            </View>
            <Text variant="captionMedium" color={colors.text.primary} weight="700">
              Riwayat
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ fontSize: 10 }}>
              Pantau paket
            </Text>
          </Pressable>
        </View>

        {/* CUSTOMIZABLE ROUTE PRESETS (Above-the-fold quick launch + Edit button) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text variant="headline" color={colors.text.primary} weight="700">
                Rute Cepat Saya
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                Ketuk untuk kirim instan atau ubah sesuai rutinitasmu
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/kelola/preset')}
              style={styles.editPresetPill}
            >
              <Text variant="captionMedium" color={colors.primary} weight="700">
                Edit / +
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetCarousel}
          >
            {presets.map((preset) => {
              const accent = preset.color || colors.primary;
              const tintBg = getPresetBg(accent);
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => launchPreset(preset)}
                  style={[styles.presetCard, { borderTopColor: accent }]}
                >
                  <View style={styles.presetTop}>
                    <View style={[styles.presetBadge, { backgroundColor: tintBg }]}>
                      <MapPin size={14} color={accent} />
                    </View>
                    {preset.defaultSize ? (
                      <View style={[styles.sizeTag, { backgroundColor: tintBg }]}>
                        <Text variant="caption" color={accent} weight="700" style={{ fontSize: 10 }}>
                          {preset.defaultCategory || 'Paket'} • {preset.defaultSize}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1} style={{ marginTop: 8 }}>
                    {preset.name}
                  </Text>
                  <Text variant="caption" color={colors.text.secondary} numberOfLines={1} style={{ marginTop: 2 }}>
                    {preset.subtitle || `${preset.pickup.label} → ${preset.dropoff.label}`}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => router.push('/kelola/preset')}
              style={styles.addPresetCard}
            >
              <View style={styles.addPresetCircle}>
                <Plus size={20} color={colors.primary} />
              </View>
              <Text variant="captionMedium" color={colors.primary} weight="700" align="center" style={{ marginTop: 6 }}>
                Buat Preset{'\n'}Baru
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* BELOW THE FOLD: Playful Safety Banner & Tips */}
        <Card variant="flat" padding="md" style={styles.safetyBanner}>
          <View style={styles.safetyRow}>
            <HandoverSparkArt width={62} height={62} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="headline" color={colors.driverDeep} weight="700">
                Aman dengan Kode 4 Digit
              </Text>
              <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2, lineHeight: 18 }}>
                Paket hanya selesai diserahkan setelah pengemudi memasukkan kode rahasia dari penerima di tujuan.
              </Text>
            </View>
          </View>
        </Card>
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
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  activeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  activeStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  activePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  activeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 6,
  },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  heroBanner: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.float,
  },
  heroBannerTop: {
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
  heroArtWrap: {
    marginLeft: 4,
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
  quickGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickTile: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  quickIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  editPresetPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
  },
  presetCarousel: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  presetCard: {
    width: 210,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderTopWidth: 4,
    ...shadows.card,
  },
  presetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  addPresetCard: {
    width: 104,
    backgroundColor: colors.primarySubtle,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  addPresetCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyBanner: {
    backgroundColor: colors.driverSubtle,
    borderWidth: 1,
    borderColor: colors.driverLight,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
