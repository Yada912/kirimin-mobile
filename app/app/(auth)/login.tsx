import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../src/theme/tokens';
import { Text, TopBar, TextField, Button, Card } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!phone.trim()) {
      setError('Nomor HP wajib diisi');
      return;
    }
    if (!password) {
      setError('Kata sandi wajib diisi');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(phone.trim(), password);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa nomor HP dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Masuk ke Kirimin" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="title" color={colors.text.primary} weight="700" style={styles.heading}>
            Selamat Datang Kembali
          </Text>
          <Text variant="callout" color={colors.text.secondary} style={styles.subheading}>
            Masukkan nomor HP dan kata sandi akun Kirimin Anda.
          </Text>

          {error && (
            <Card variant="flat" padding="md" style={styles.errorCard}>
              <Text variant="callout" color={colors.semantic.danger}>
                {error}
              </Text>
            </Card>
          )}

          <TextField
            label="Nomor Handphone"
            placeholder="Contoh: 081234567890"
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              setError(null);
            }}
            keyboardType="phone-pad"
            autoCapitalize="none"
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
          />

          <Button
            label="Masuk"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />

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
    padding: spacing.xl,
  },
  heading: {
    marginBottom: spacing.xs,
  },
  subheading: {
    marginBottom: spacing.xl,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.lg,
  },
  submitBtn: {
    marginTop: spacing.md,
  },
  registerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
});
