import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, Lock, Package, Bike, Sparkles } from 'lucide-react-native';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { Text, TopBar, TextField, Button, Card, BrandLogo } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (overridePhone?: string, overridePassword?: string) => {
    const p = (overridePhone ?? phone).trim();
    const pw = overridePassword ?? password;
    if (!p) {
      setError('Nomor HP wajib diisi');
      return;
    }
    if (!pw) {
      setError('Kata sandi wajib diisi');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(p, pw);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa nomor HP dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Masuk" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.banner}>
            <View style={{ flex: 1 }}>
              <BrandLogo size="md" tone="light" />
              <Text variant="caption" color="#DBEAFE" style={{ marginTop: 5 }}>
                Masuk untuk melacak paket atau mulai rute angkutmu.
              </Text>
            </View>
            <Sparkles size={20} color="#FDE047" />
          </View>

          {error && (
            <Card variant="flat" padding="md" style={styles.errorCard}>
              <Text variant="callout" color={colors.semantic.danger}>
                {error}
              </Text>
            </Card>
          )}

          <TextField
            label="Nomor Handphone"
            placeholder="Contoh: 081200000001"
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              setError(null);
            }}
            keyboardType="phone-pad"
            autoCapitalize="none"
            leftElement={<Phone size={17} color={colors.text.muted} />}
          />

          <TextField
            label="Kata Sandi"
            placeholder="Masukkan kata sandi"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            secureTextEntry
            leftElement={<Lock size={17} color={colors.text.muted} />}
          />

          <Button
            label="Masuk"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={() => handleSubmit()}
            style={styles.submitBtn}
          />

          {/* Quick Demo Accounts Strip for effortless testing */}
          <Card variant="flat" padding="md" style={styles.demoCard}>
            <Text variant="captionMedium" color={colors.text.secondary} weight="700" style={{ marginBottom: spacing.xs }}>
              Akses Cepat Akun Demo (Bali)
            </Text>
            <View style={styles.demoRow}>
              <Pressable
                onPress={() => {
                  setPhone('081200000001');
                  setPassword('kirimin123');
                  handleSubmit('081200000001', 'kirimin123');
                }}
                style={[styles.demoPill, { backgroundColor: colors.primaryLight }]}
              >
                <Package size={14} color={colors.primary} />
                <Text variant="captionMedium" color={colors.primary} weight="700" style={{ marginLeft: 5 }}>
                  Wayan (Pengirim)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setPhone('081200000003');
                  setPassword('kirimin123');
                  handleSubmit('081200000003', 'kirimin123');
                }}
                style={[styles.demoPill, { backgroundColor: colors.driverLight }]}
              >
                <Bike size={14} color={colors.driverDeep} />
                <Text variant="captionMedium" color={colors.driverDeep} weight="700" style={{ marginLeft: 5 }}>
                  Made S. (Driver)
                </Text>
              </Pressable>
            </View>
          </Card>

          <View style={styles.registerLink}>
            <Text variant="callout" color={colors.text.secondary}>
              Belum punya akun?{' '}
            </Text>
            <Button
              label="Daftar Sekarang"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => router.replace('/(auth)/register')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  demoCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  demoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  demoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  registerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
});
