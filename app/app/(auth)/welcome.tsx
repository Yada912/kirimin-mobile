import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bike, ShieldCheck, Navigation, Sparkles } from 'lucide-react-native';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import { Text, Button, WelcomeHeroArt, BrandLogo } from '../../src/ui';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSection}>
        {/* Vibrant App-Native Brand Bar */}
        <View style={styles.brandHeaderRow}>
          <BrandLogo size="sm" tone="brand" surface="soft" testID="welcome-brand-logo" />
          <View style={styles.badgeRow}>
            <Sparkles size={12} color={colors.primary} />
            <Text variant="captionMedium" color={colors.primary} weight="700" style={{ marginLeft: 4 }}>
              BALI SEARAH
            </Text>
          </View>
        </View>

        {/* Colorful Hero Illustration Banner */}
        <View style={styles.heroArtCard}>
          <WelcomeHeroArt width={330} height={164} />
        </View>

        <BrandLogo size="xl" tone="brand" style={{ marginTop: 2 }} />
        <Text variant="callout" color={colors.text.secondary} align="center" style={styles.tagline}>
          Titip paket ke pengendara yang sudah searah perjalanan. Lebih hemat, cepat, dengan navigasi jalan live.
        </Text>
      </View>

      {/* Compact Highlights Grid (No Scroll Needed!) */}
      <View style={styles.featureGrid}>
        <View style={[styles.featureChip, { backgroundColor: colors.primarySubtle, borderColor: '#BFDBFE' }]}>
          <Bike size={18} color={colors.primary} />
          <Text variant="captionMedium" color={colors.text.primary} weight="700" style={{ marginTop: 4 }}>
            2 Peran Fleksibel
          </Text>
          <Text variant="caption" color={colors.text.secondary} align="center" style={{ fontSize: 11 }}>
            Kirim paket atau cuan di rute harian
          </Text>
        </View>

        <View style={[styles.featureChip, { backgroundColor: colors.driverSubtle, borderColor: colors.driverLight }]}>
          <Navigation size={18} color={colors.driver} />
          <Text variant="captionMedium" color={colors.text.primary} weight="700" style={{ marginTop: 4 }}>
            Peta Jalan Live
          </Text>
          <Text variant="caption" color={colors.text.secondary} align="center" style={{ fontSize: 11 }}>
            Panduan belokan & kode aman 4 digit
          </Text>
        </View>
      </View>

      <View style={styles.trustRow}>
        <ShieldCheck size={15} color={colors.driver} />
        <Text variant="caption" color={colors.text.secondary} style={{ marginLeft: 5 }}>
          Verifikasi kode serah terima 4 digit di setiap pengantaran
        </Text>
      </View>

      {/* Primary Thumb-Reach CTA Section */}
      <View style={styles.actionSection}>
        <Button
          label="Daftar Akun Baru"
          variant="primary"
          size="lg"
          onPress={() => router.push('/(auth)/register')}
          style={styles.mainBtn}
          testID="welcome-register-btn"
        />
        <Button
          label="Sudah Punya Akun? Masuk"
          variant="outline"
          size="lg"
          onPress={() => router.push('/(auth)/login')}
          testID="welcome-login-btn"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  topSection: {
    alignItems: 'center',
  },
  brandHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  heroArtCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadows.float,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  tagline: {
    marginTop: spacing.xs,
    maxWidth: 320,
    lineHeight: 20,
  },
  featureGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  featureChip: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionSection: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  mainBtn: {
    marginBottom: 2,
  },
});
