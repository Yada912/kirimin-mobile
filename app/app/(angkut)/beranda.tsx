import React from 'react';
import { StyleSheet, View, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, Plus, Wallet, Star, Repeat, MapPin, ChevronRight } from '../../src/ui/icons';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import { Text, SkeletonCard, Avatar, SearahScene, Button } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';
import { useTripsMine, useStats } from '../../src/api/hooks/useApi';
import { formatRupiah, formatTime } from '../../src/utils/format';
import { useRoutePresets } from '../../src/features/presets/useRoutePresets';

export default function AngkutBerandaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { data: trips, isLoading: tripsLoading } = useTripsMine('active');
  const { data: stats } = useStats();
  const { presets } = useRoutePresets();

  const activeTrip = trips && trips.length > 0 ? trips[0] : null;
  const firstName = (user?.name || 'kamu').split(' ')[0];
  const ongoing = activeTrip?.status === 'ongoing';

  const openTrip = () => {
    if (!activeTrip) return;
    router.push(
      ongoing
        ? { pathname: '/angkut/jalan/[tripId]', params: { tripId: activeTrip.id } }
        : { pathname: '/angkut/permintaan/[tripId]', params: { tripId: activeTrip.id } },
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(angkut)/profil')} style={[styles.userRow, { flex: 1, marginRight: spacing.sm }]} hitSlop={6}>
            <Avatar name={user?.name || 'Pengemudi'} url={user?.avatarUrl} size={40} />
            <Text variant="title" color={colors.driverDeep} style={{ marginLeft: spacing.sm, flexShrink: 1 }} numberOfLines={1}>
              Halo, {firstName}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(auth)/pilih-peran')} style={styles.roleSwitch} hitSlop={6}>
            <Repeat size={14} color={colors.sawah} />
            <Text variant="captionMedium" color={colors.sawah} weight="700" style={{ marginLeft: 6 }}>
              Pengirim
            </Text>
          </Pressable>
        </View>

        {/* The one thing to do next: run the trip you have, or post one. */}
        {tripsLoading ? (
          <SkeletonCard />
        ) : (
          <View style={styles.hero}>
            <View style={StyleSheet.absoluteFill}>
              <SearahScene width={width - spacing.lg * 2} height={250} tone="angkut" />
            </View>
            {activeTrip ? (
              <View>
                <Text variant="callout" color={colors.sawahLight}>
                  {ongoing ? 'Sedang berjalan' : `Berangkat ${formatTime(activeTrip.departAt)}`}
                </Text>
                <Text variant="largeTitle" color="#FFFFFF" numberOfLines={2} style={{ marginTop: 2 }}>
                  {activeTrip.origin.label} ke {activeTrip.destination.label}
                </Text>
                <Text variant="callout" color={colors.sawahLight} style={{ marginTop: 4 }}>
                  {activeTrip.slotsUsed} dari {activeTrip.maxPackages} tempat paket terisi
                </Text>
              </View>
            ) : (
              <View style={{ maxWidth: 270 }}>
                <Text variant="largeTitle" color="#FFFFFF">
                  Lewat mana hari ini?
                </Text>
                <Text variant="callout" color={colors.sawahLight} style={{ marginTop: 4 }}>
                  Pasang rutemu, pengirim yang searah akan menitipkan paket.
                </Text>
              </View>
            )}
            <Button
              label={activeTrip ? (ongoing ? 'Lanjutkan navigasi' : 'Lihat permintaan') : 'Pasang rute'}
              size="lg"
              leftIcon={activeTrip ? <Navigation size={18} color={colors.driverDeep} /> : <Plus size={18} color={colors.driverDeep} />}
              onPress={activeTrip ? openTrip : () => router.push('/angkut/buat-rute')}
              style={styles.heroBtn}
              textColor={colors.driverDeep}
              testID={activeTrip ? 'active-trip-cta' : 'buat-rute-cta'}
            />
          </View>
        )}

        {activeTrip ? (
          <Pressable onPress={() => router.push('/angkut/buat-rute')} style={styles.secondaryLink} testID="buat-rute-cta">
            <Plus size={16} color={colors.sawah} />
            <Text variant="calloutSemibold" color={colors.sawah} style={{ marginLeft: 6 }}>
              Pasang rute lain
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: colors.sawahLight }]}>
              <Wallet size={20} color={colors.sawah} />
            </View>
            <View style={{ marginLeft: spacing.sm }}>
              <Text variant="caption" color={colors.text.secondary}>
                Penghasilan
              </Text>
              <Text variant="headline">{formatRupiah(stats?.driver?.earningsTotal ?? 0)}</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: colors.kunyitLight }]}>
              <Star size={20} color="#B7791F" weight="fill" />
            </View>
            <View style={{ marginLeft: spacing.sm }}>
              <Text variant="caption" color={colors.text.secondary}>
                {user?.ratingCount ?? 0} ulasan
              </Text>
              <Text variant="headline">{user?.ratingAvg ? user.ratingAvg.toFixed(1) : 'Baru'}</Text>
            </View>
          </View>
        </View>

        {presets.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text variant="headline">Pasang lagi rute favorit</Text>
              <Pressable onPress={() => router.push('/kelola/preset')} hitSlop={8}>
                <Text variant="calloutSemibold" color={colors.sawah}>
                  Atur
                </Text>
              </Pressable>
            </View>
            <View style={styles.list}>
              {presets.slice(0, 3).map((preset, i) => (
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
                  style={({ pressed }) => [styles.listRow, i > 0 && styles.listDivider, pressed && { backgroundColor: colors.surfaceSecondary }]}
                >
                  <View style={[styles.pinTile, { backgroundColor: colors.sawahLight }]}>
                    <MapPin size={20} color={colors.sawah} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text variant="calloutSemibold" numberOfLines={1}>
                      {preset.name}
                    </Text>
                    <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
                      {preset.pickup.label} ke {preset.dropoff.label}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.text.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
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
    backgroundColor: colors.sawahLight,
  },
  hero: {
    minHeight: 250,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.driverDeep,
    padding: spacing.lg,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    ...shadows.float,
  },
  heroBtn: {
    backgroundColor: '#FFFFFF',
    marginTop: spacing.lg,
  },
  secondaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
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
});
