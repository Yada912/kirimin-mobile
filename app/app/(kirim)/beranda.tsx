import React from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Plus, MapPin, ArrowRight, ShieldCheck, Clock } from 'lucide-react-native';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import { Text, Card, Button, StatusPill, SkeletonCard, Avatar } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';
import { useOrders } from '../../src/api/hooks/useApi';

export default function KirimBerandaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: activeOrders, isLoading } = useOrders('sender', 'active');

  const activeOrder = activeOrders && activeOrders.length > 0 ? activeOrders[0] : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.userRow}>
            <Avatar name={user?.name || 'Pengirim'} url={user?.avatarUrl} size={44} />
            <View style={styles.userInfo}>
              <Text variant="captionMedium" color={colors.text.secondary}>
                Selamat datang,
              </Text>
              <Text variant="headline" color={colors.text.primary} weight="700">
                {user?.name || 'Pengguna'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/(auth)/pilih-peran')}
            style={styles.roleSwitch}
          >
            <Text variant="captionMedium" color={colors.primary} weight="600">
              Peran: Kirim ▾
            </Text>
          </Pressable>
        </View>

        {/* Active Order Banner (If Any) */}
        {isLoading ? (
          <SkeletonCard />
        ) : activeOrder ? (
          <Card
            onPress={() => router.push({ pathname: '/kirim/lacak/[id]', params: { id: activeOrder.id } })}
            style={styles.activeOrderCard}
          >
            <View style={styles.activeHeader}>
              <View style={styles.activeLeft}>
                <Clock size={16} color={colors.primary} />
                <Text variant="captionMedium" color={colors.primary} weight="600" style={{ marginLeft: 4 }}>
                  Kiriman Aktif ({activeOrder.code})
                </Text>
              </View>
              <StatusPill status={activeOrder.status} />
            </View>

            <View style={styles.routeRow}>
              <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                {activeOrder.pickup.label}
              </Text>
              <Text variant="callout" color={colors.text.muted} style={{ marginHorizontal: 6 }}>
                →
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                {activeOrder.dropoff.label}
              </Text>
            </View>

            <View style={styles.activeFooter}>
              <Text variant="caption" color={colors.text.secondary}>
                Ketuk untuk melacak posisi driver & kode serah terima
              </Text>
              <ArrowRight size={16} color={colors.primary} />
            </View>
          </Card>
        ) : null}

        {/* Hero CTA Card */}
        <Card variant="elevated" padding="xl" style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Package size={28} color={colors.primary} />
          </View>
          <Text variant="title" color={colors.text.primary} weight="700" style={styles.heroTitle}>
            Titip Kirim Paket
          </Text>
          <Text variant="callout" color={colors.text.secondary} style={styles.heroSubtitle}>
            Temukan driver yang melewati rute tujuan Anda dalam hitungan menit.
          </Text>
          <Button
            label="Kirim Paket Sekarang"
            variant="primary"
            size="lg"
            leftIcon={<Plus size={18} color="#FFF" />}
            onPress={() => router.push('/kirim/paket')}
            style={styles.heroBtn}
          />
        </Card>

        {/* Rute Populer / Preset Shortcuts */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Rute Populer di Bali
          </Text>

          <View style={styles.presetGrid}>
            <Card
              onPress={() =>
                router.push({
                  pathname: '/kirim/paket',
                  params: {
                    pickupPreset: 'Jl. Tukad Badung, Renon',
                    dropoffPreset: 'Gedung FT Kampus Bukit',
                  },
                })
              }
              variant="outlined"
              padding="md"
              style={styles.presetCard}
            >
              <MapPin size={18} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="calloutSemibold" color={colors.text.primary}>
                  Renon → Kampus Bukit
                </Text>
                <Text variant="caption" color={colors.text.secondary}>
                  Jalur komuter mahasiswa & pekerja
                </Text>
              </View>
            </Card>

            <Card
              onPress={() =>
                router.push({
                  pathname: '/kirim/paket',
                  params: {
                    pickupPreset: 'Sesetan',
                    dropoffPreset: 'Jimbaran',
                  },
                })
              }
              variant="outlined"
              padding="md"
              style={styles.presetCard}
            >
              <MapPin size={18} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="calloutSemibold" color={colors.text.primary}>
                  Sesetan → Jimbaran
                </Text>
                <Text variant="caption" color={colors.text.secondary}>
                  Tersedia banyak driver motor
                </Text>
              </View>
            </Card>
          </View>
        </View>

        {/* How It Works Banner */}
        <Card variant="flat" padding="lg" style={styles.infoBanner}>
          <View style={styles.infoRow}>
            <ShieldCheck size={24} color={colors.semantic.success} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="headline" color={colors.text.primary} weight="600">
                Aman dengan Kode 4 Digit
              </Text>
              <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 2 }}>
                Paket hanya selesai diserahkan setelah pengemudi memasukkan kode rahasia dari penerima.
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
  activeOrderCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginBottom: spacing.lg,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  activeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
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
  heroBtn: {
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  presetGrid: {
    gap: spacing.sm,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  infoBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
