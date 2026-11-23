import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Switch, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  Bike,
  Car,
  Bell,
  ShieldCheck,
  Sparkles,
} from '../../src/ui/icons';
import type { NotificationChannel, VehicleType } from '@kirimin/shared';
import { NOTIFICATION_CHANNELS, NOTIFICATION_CHANNEL_LABELS } from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { Text, TopBar, Card, Button, TextField, Divider } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';
import {
  useUpdateProfile,
  useUserSettings,
  useUpdateUserSettings,
  useSubmitVerification,
} from '../../src/api/hooks/useApi';

export default function KelolaProfilScreen() {
  const { user, setUserLocal } = useAuth();
  const { data: settings } = useUserSettings();
  const { mutateAsync: updateProfile, isPending: savingProfile } = useUpdateProfile();
  const { mutateAsync: updateSettings } = useUpdateUserSettings();
  const { mutateAsync: submitVerification, isPending: verifying } = useSubmitVerification();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [vehicleType, setVehicleType] = useState<VehicleType>(user?.vehicle?.type || 'motor');
  const [plate, setPlate] = useState(user?.vehicle?.plate || '');
  const [pushPrefs, setPushPrefs] = useState<Record<NotificationChannel, boolean>>({
    orders: true,
    chat: true,
    trips: true,
    promos: true,
  });
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.push) {
      setPushPrefs(settings.push);
    }
  }, [settings?.push]);

  const handleSaveProfile = async () => {
    if (name.trim().length < 2) {
      setError('Nama minimal 2 karakter');
      return;
    }
    try {
      setError(null);
      const updated = await updateProfile({
        name: name.trim(),
        email: email.trim() ? email.trim() : null,
        vehicle: plate.trim().length >= 3 ? { type: vehicleType, plate: plate.trim().toUpperCase() } : undefined,
      });
      setUserLocal(updated);
      setBanner('Profil dan data kendaraan berhasil diperbarui!');
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan profil');
    }
  };

  const handleTogglePush = async (channel: NotificationChannel, val: boolean) => {
    const next = { ...pushPrefs, [channel]: val };
    setPushPrefs(next);
    try {
      await updateSettings({ push: { [channel]: val } });
    } catch {
      setPushPrefs(pushPrefs);
    }
  };

  const handleQuickVerify = async () => {
    try {
      setError(null);
      const updated = await submitVerification({
        ktpPhotoUrl: 'https://kirimin.app/verified/ktp-demo.jpg',
        selfiePhotoUrl: 'https://kirimin.app/verified/selfie-demo.jpg',
      });
      setUserLocal(updated);
      setBanner('Verifikasi identitas KTP berhasil dikonfirmasi!');
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim verifikasi');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Ubah profil" subtitle="Akun, kendaraan, dan notifikasi" />

      <ScrollView contentContainerStyle={styles.content}>
        {banner ? (
          <Card variant="flat" padding="sm" style={styles.successBanner}>
            <Sparkles size={15} color={colors.driver} />
            <Text variant="captionMedium" color={colors.driverDeep} weight="700" style={{ marginLeft: 6, flex: 1 }}>
              {banner}
            </Text>
          </Card>
        ) : null}

        {error ? (
          <Card variant="flat" padding="sm" style={styles.errorBanner}>
            <Text variant="captionMedium" color={colors.semantic.danger}>
              {error}
            </Text>
          </Card>
        ) : null}

        {/* Account Info */}
        <Card variant="elevated" padding="lg" style={styles.card}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginBottom: spacing.sm }}>
            Data Akun
          </Text>
          <TextField
            label="Nama lengkap"
            value={name}
            onChangeText={setName}
            leftElement={<User size={17} color={colors.text.muted} />}
          />
          <TextField
            label="Email (opsional)"
            placeholder="nama@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leftElement={<Mail size={17} color={colors.text.muted} />}
          />
        </Card>

        {/* Vehicle Settings */}
        <Card variant="elevated" padding="lg" style={styles.card}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginBottom: 4 }}>
            Kendaraan Pengemudi
          </Text>
          <Text variant="caption" color={colors.text.secondary} style={{ marginBottom: spacing.md }}>
            Dipakai saat kamu jadi pengemudi.
          </Text>

          <View style={styles.vehicleRow}>
            <Pressable
              onPress={() => setVehicleType('motor')}
              style={[styles.vehicleCard, vehicleType === 'motor' && styles.vehicleCardActive]}
            >
              <Bike size={22} color={vehicleType === 'motor' ? colors.driver : colors.text.secondary} />
              <Text
                variant="calloutSemibold"
                color={vehicleType === 'motor' ? colors.driverDeep : colors.text.primary}
                style={{ marginTop: 4 }}
              >
                Sepeda Motor
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Paket XS – M
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setVehicleType('mobil')}
              style={[styles.vehicleCard, vehicleType === 'mobil' && styles.vehicleCardActive]}
            >
              <Car size={22} color={vehicleType === 'mobil' ? colors.driver : colors.text.secondary} />
              <Text
                variant="calloutSemibold"
                color={vehicleType === 'mobil' ? colors.driverDeep : colors.text.primary}
                style={{ marginTop: 4 }}
              >
                Mobil
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Paket XS – L
              </Text>
            </Pressable>
          </View>

          <TextField
            label="Plat nomor"
            placeholder="Contoh: DK 1101 XL"
            value={plate}
            onChangeText={setPlate}
            autoCapitalize="characters"
            containerStyle={{ marginTop: spacing.md }}
          />

          <Button
            label="Simpan"
            variant="primary"
            size="lg"
            loading={savingProfile}
            onPress={handleSaveProfile}
            style={{ marginTop: spacing.xs }}
          />
        </Card>

        {/* KTP Verification Card */}
        <Card variant="outlined" padding="lg" style={styles.card}>
          <View style={styles.verifyRow}>
            <View style={[styles.verifyIcon, user?.verified && { backgroundColor: colors.driverLight }]}>
              <ShieldCheck size={22} color={user?.verified ? colors.driver : colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="headline" color={colors.text.primary} weight="700">
                Verifikasi Identitas KTP
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                {user?.verified
                  ? 'Akunmu sudah memiliki lencana Terverifikasi.'
                  : 'Tingkatkan kepercayaan pengirim & driver dengan lencana Terverifikasi.'}
              </Text>
            </View>
          </View>
          {!user?.verified ? (
            <Button
              label="Verifikasi sekarang"
              variant="outline"
              size="md"
              loading={verifying}
              onPress={handleQuickVerify}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
        </Card>

        {/* Notification Preferences */}
        <Card variant="outlined" padding="lg" style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Bell size={18} color={colors.primary} />
            <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginLeft: 8 }}>
              Preferensi Notifikasi
            </Text>
          </View>
          {NOTIFICATION_CHANNELS.map((ch, idx) => (
            <View key={ch}>
              {idx > 0 && <Divider style={{ marginVertical: spacing.sm }} />}
              <View style={styles.switchRow}>
                <Text variant="calloutSemibold" color={colors.text.primary}>
                  {NOTIFICATION_CHANNEL_LABELS[ch]}
                </Text>
                <Switch
                  value={pushPrefs[ch]}
                  onValueChange={(v) => handleTogglePush(ch, v)}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={pushPrefs[ch] ? colors.primary : '#FFFFFF'}
                />
              </View>
            </View>
          ))}
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
    paddingBottom: 40,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.driverSubtle,
    borderWidth: 1,
    borderColor: colors.driverLight,
    marginBottom: spacing.md,
  },
  errorBanner: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  vehicleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  vehicleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  vehicleCardActive: {
    borderColor: colors.driver,
    backgroundColor: colors.driverSubtle,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
});
