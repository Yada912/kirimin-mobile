import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Bike, ShieldCheck } from 'lucide-react-native';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { Text, Button, Card } from '../../src/ui';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Package size={38} color={colors.primary} />
        </View>
        <Text variant="largeTitle" color={colors.text.primary} weight="700" align="center">
          Kirimin
        </Text>
        <Text variant="callout" color={colors.text.secondary} align="center" style={styles.tagline}>
          Titip kirim paket ke pengendara yang sudah searah perjalanan. Lebih cepat, hemat, dan ramah lingkungan.
        </Text>
      </View>

      <View style={styles.heroFeature}>
        <Card variant="flat" padding="md" style={styles.featureCard}>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Bike size={20} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text variant="headline" color={colors.text.primary}>
                Kirim & Angkut Searah
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                Bisa jadi pengirim paket (Kirim) atau pengemudi harian (Angkut) kapan saja.
              </Text>
            </View>
          </View>
        </Card>

        <Card variant="flat" padding="md" style={styles.featureCard}>
          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: colors.semantic.successLight }]}>
              <ShieldCheck size={20} color={colors.semantic.success} />
            </View>
            <View style={styles.featureText}>
              <Text variant="headline" color={colors.text.primary}>
                Serah Terima Aman 4 Digit
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                Pelacakan rute langsung dan verifikasi kode rahasia saat paket tiba di tujuan.
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.actionSection}>
        <Button
          label="Masuk ke Akun"
          variant="primary"
          size="lg"
          onPress={() => router.push('/(auth)/login')}
          style={styles.mainBtn}
        />
        <Button
          label="Daftar Akun Baru"
          variant="secondary"
          size="lg"
          onPress={() => router.push('/(auth)/register')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xxxl,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tagline: {
    marginTop: spacing.sm,
    maxWidth: 310,
    lineHeight: 22,
  },
  heroFeature: {
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  featureCard: {
    backgroundColor: colors.surface,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featureText: {
    flex: 1,
  },
  actionSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  mainBtn: {
    marginBottom: spacing.xs,
  },
});
