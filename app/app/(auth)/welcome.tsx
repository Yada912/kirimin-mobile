import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Bike, Sparkles } from 'lucide-react-native';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { Text, Button, Card } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';

export default function WelcomeScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [demoLoading, setDemoLoading] = React.useState<string | null>(null);

  const handleQuickLogin = async (phone: string, roleName: string) => {
    try {
      setDemoLoading(phone);
      await login(phone, 'kirimin123');
      router.replace('/');
    } catch (err: any) {
      alert(err.message || 'Gagal login demo');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Package size={36} color={colors.primary} />
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
      </View>

      <View style={styles.demoSection}>
        <Text variant="captionMedium" color={colors.text.muted} align="center" style={styles.demoTitle}>
          AKUN DEMO CEPAT (TAP UNTUK MASUK)
        </Text>
        <View style={styles.demoButtons}>
          <Button
            label="Masuk: Wayan (Pengirim)"
            variant="outline"
            size="sm"
            loading={demoLoading === '081200000001'}
            disabled={!!demoLoading}
            onPress={() => handleQuickLogin('081200000001', 'sender')}
            style={styles.demoBtn}
          />
          <Button
            label="Masuk: Made (Driver)"
            variant="outline"
            size="sm"
            loading={demoLoading === '081200000003'}
            disabled={!!demoLoading}
            onPress={() => handleQuickLogin('081200000003', 'driver')}
            style={styles.demoBtn}
          />
        </View>
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
    marginTop: spacing.xl,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tagline: {
    marginTop: spacing.sm,
    maxWidth: 300,
    lineHeight: 22,
  },
  heroFeature: {
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
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featureText: {
    flex: 1,
  },
  demoSection: {
    marginVertical: spacing.sm,
  },
  demoTitle: {
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  demoButtons: {
    gap: spacing.xs,
  },
  demoBtn: {
    backgroundColor: colors.surface,
  },
  actionSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  mainBtn: {
    marginBottom: spacing.xs,
  },
});

