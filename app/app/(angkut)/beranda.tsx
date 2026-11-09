import React from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, Plus, ArrowRight, Wallet, Users, Compass } from 'lucide-react-native';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { Text, Card, Button, StatusPill, SkeletonCard, Avatar } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';
import { useTripsMine, useStats } from '../../src/api/hooks/useApi';
import { formatRupiah, formatTime } from '../../src/utils/format';

export default function AngkutBerandaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: trips, isLoading: tripsLoading } = useTripsMine('active');
  const { data: stats } = useStats();

  const activeTrip = trips && trips.length > 0 ? trips[0] : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.userRow}>
            <Avatar name={user?.name || 'Driver'} url={user?.avatarUrl} size={44} />
            <View style={styles.userInfo}>
              <Text variant="captionMedium" color={colors.text.secondary}>
                Selamat bertugas,
              </Text>
              <Text variant="headline" color={colors.text.primary} weight="700">
                {user?.name || 'Driver'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/(auth)/pilih-peran')}
            style={styles.roleSwitch}
          >
            <Text variant="captionMedium" color={colors.primary} weight="600">
              Peran: Angkut ▾
            </Text>
          </Pressable>
        </View>

        {/* Active Trip Card (If ongoing or published) */}
        {tripsLoading ? (
          <SkeletonCard />
        ) : activeTrip ? (
          <Card
            onPress={() => {
              if (activeTrip.status === 'ongoing') {
                router.push({ pathname: '/angkut/jalan/[tripId]', params: { tripId: activeTrip.id } });
              } else {
                router.push({ pathname: '/angkut/permintaan/[tripId]', params: { tripId: activeTrip.id } });
              }
            }}
            style={styles.activeTripCard}
          >
            <View style={styles.activeHeader}>
              <View style={styles.tripBadge}>
                <Navigation size={16} color={colors.primary} />
                <Text variant="captionMedium" color={colors.primary} weight="600" style={{ marginLeft: 4 }}>
                  {activeTrip.name}
                </Text>
              </View>
              <StatusPill status={activeTrip.status} />
            </View>

            <View style={styles.routeRow}>
              <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                {activeTrip.origin.label}
              </Text>
              <Text variant="callout" color={colors.text.muted} style={{ marginHorizontal: 6 }}>
                →
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                {activeTrip.destination.label}
              </Text>
            </View>

            <View style={styles.tripMetaRow}>
              <Text variant="caption" color={colors.text.secondary}>
                Berangkat: {formatTime(activeTrip.departAt)} • Terpakai: {activeTrip.slotsUsed}/{activeTrip.maxPackages} slot
              </Text>
            </View>

            <View style={styles.activeFooter}>
              <Text variant="caption" color={colors.primary} weight="600">
                {activeTrip.status === 'ongoing' ? 'Buka Perjalanan Aktif & Manifest' : 'Lihat Permintaan Masuk'}
              </Text>
              <ArrowRight size={16} color={colors.primary} />
            </View>
          </Card>
        ) : null}

        {/* Hero CTA: Publikasikan Rute */}
        <Card variant="elevated" padding="xl" style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Compass size={28} color={colors.primary} />
          </View>
          <Text variant="title" color={colors.text.primary} weight="700" style={styles.heroTitle}>
            Rute Perjalanan Harian
          </Text>
          <Text variant="callout" color={colors.text.secondary} style={styles.heroSubtitle}>
            Publikasikan rute perjalanan Anda ke kampus atau kantor untuk mendapatkan titipan paket searah.
          </Text>
          <Button
            label="Publikasikan Rute Baru"
            variant="primary"
            size="lg"
            leftIcon={<Plus size={18} color="#FFF" />}
            onPress={() => router.push('/angkut/buat-rute')}
          />
        </Card>

        {/* Ringkasan Penghasilan Driver */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Ringkasan Pengemudi
          </Text>

          <View style={styles.statsGrid}>
            <Card variant="flat" padding="md" style={styles.statBox}>
              <View style={styles.statIconRow}>
                <Wallet size={20} color={colors.semantic.success} />
                <Text variant="captionMedium" color={colors.text.secondary}>
                  Penghasilan
                </Text>
              </View>
              <Text variant="title" color={colors.text.primary} weight="700" style={{ marginTop: 6 }}>
                {formatRupiah(stats?.driver?.earningsTotal ?? 48000)}
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Bulan ini
              </Text>
            </Card>

            <Card variant="flat" padding="md" style={styles.statBox}>
              <View style={styles.statIconRow}>
                <Users size={20} color={colors.primary} />
                <Text variant="captionMedium" color={colors.text.secondary}>
                  Paket Terkirim
                </Text>
              </View>
              <Text variant="title" color={colors.text.primary} weight="700" style={{ marginTop: 6 }}>
                {user?.deliveriesCount ?? 8}
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Rating: {user?.ratingAvg ? user.ratingAvg.toFixed(1) : '5.0'} ★
              </Text>
            </Card>
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
    padding: spacing.lg,
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
  userInfo: {
    marginLeft: spacing.md,
  },
  roleSwitch: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
  },
  activeTripCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  tripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  tripMetaRow: {
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  activeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  heroCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.xl,
  },
  heroBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
