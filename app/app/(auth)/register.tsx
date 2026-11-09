import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Role } from '@kirimin/shared';
import { colors, spacing } from '../../src/theme/tokens';
import { Text, TopBar, TextField, Button, SegmentedControl, Card } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('sender');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Nama lengkap wajib diisi');
      return;
    }
    if (!phone.trim()) {
      setError('Nomor HP wajib diisi');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        role,
      });
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Gagal mendaftar. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Daftar Akun Baru" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="title" color={colors.text.primary} weight="700" style={styles.heading}>
            Bergabung dengan Kirimin
          </Text>
          <Text variant="callout" color={colors.text.secondary} style={styles.subheading}>
            Mulai kirim paket atau hasilkan penghasilan dari rute perjalanan Anda.
          </Text>

          {error && (
            <Card variant="flat" padding="md" style={styles.errorCard}>
              <Text variant="callout" color={colors.semantic.danger}>
                {error}
              </Text>
            </Card>
          )}

          <TextField
            label="Nama Lengkap"
            placeholder="Contoh: Ketut Suartika"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError(null);
            }}
          />

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
            placeholder="Minimal 6 karakter"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            secureTextEntry
          />

          <View style={styles.roleSection}>
            <Text variant="captionMedium" color={colors.text.secondary} style={styles.roleLabel}>
              Peran Utama
            </Text>
            <SegmentedControl<Role>
              options={[
                { value: 'sender', label: 'Pengirim (Kirim)' },
                { value: 'driver', label: 'Pengemudi (Angkut)' },
              ]}
              value={role}
              onChange={setRole}
            />
          </View>

          <Button
            label="Daftar Sekarang"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />
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
    marginBottom: spacing.md,
  },
  roleSection: {
    marginVertical: spacing.md,
  },
  roleLabel: {
    marginBottom: spacing.xs,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
});

