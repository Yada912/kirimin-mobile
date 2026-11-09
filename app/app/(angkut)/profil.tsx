import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Bike, ShieldCheck, HelpCircle, FileText, LogOut } from 'lucide-react-native';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Avatar,
  Button,
  ListItem,
  Divider,
  Dialog,
} from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';

export default function AngkutProfilScreen() {
  const router = useRouter();
  const { user, logout, switchRole } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleSwitchRole = async () => {
    try {
      setSwitching(true);
      await switchRole('sender');
      router.replace('/(kirim)/beranda');
    } catch (err: any) {
      alert(err.message || 'Gagal berganti peran');
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutDialog(false);
    await logout();
    router.replace('/(auth)/welcome');
  };

  const vehicle = user?.vehicle || { type: 'motor', plate: 'DK 1101 XL' };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Profil Pengemudi" canGoBack={false} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <Card variant="elevated" padding="lg" style={styles.userCard}>
          <View style={styles.userRow}>
            <Avatar name={user?.name || 'Driver'} url={user?.avatarUrl} size={60} />
            <View style={styles.userInfo}>
              <Text variant="title" color={colors.text.primary} weight="700">
                {user?.name || 'Pengemudi Kirimin'}
              </Text>
              <Text variant="callout" color={colors.text.secondary}>
                {user?.phone}
              </Text>
              {user?.verified && (
                <View style={styles.verifiedRow}>
                  <ShieldCheck size={14} color={colors.semantic.success} />
                  <Text variant="captionMedium" color={colors.semantic.success} style={{ marginLeft: 4 }}>
                    KTP & SIM Terverifikasi
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Divider style={{ marginVertical: spacing.md }} />

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text variant="headline" color={colors.semantic.success} weight="700">
                {user?.deliveriesCount ?? 8}
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Paket Diantar
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text variant="headline" color={colors.text.primary} weight="700">
                {user?.ratingAvg ? user.ratingAvg.toFixed(1) : '5.0'} ★
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Rating ({user?.ratingCount ?? 0})
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text variant="headline" color={colors.primary} weight="700">
                {vehicle.plate}
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                {vehicle.type.toUpperCase()}
              </Text>
            </View>
          </View>
        </Card>

        {/* Switch Role Card */}
        <Card variant="flat" padding="md" style={styles.switchCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchIcon}>
              <Package size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="headline" color={colors.text.primary} weight="600">
                Beralih ke Mode Kirim
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                Kirim paket titipan melalui pengemudi searah.
              </Text>
            </View>
          </View>
          <Button
            label="Ganti ke Kirim (Pengirim)"
            variant="outline"
            size="md"
            loading={switching}
            onPress={handleSwitchRole}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Menu Section */}
        <View style={styles.menuCard}>
          <ListItem
            title="Kendaraan Terdaftar"
            subtitle={`${vehicle.type.toUpperCase()} - ${vehicle.plate}`}
            leftIcon={<Bike size={22} color={colors.primary} />}
            onPress={() => router.push('/placeholder')}
            showChevron
          />
          <Divider />
          <ListItem
            title="Bantuan & Dukungan Driver"
            subtitle="Panduan operasional dan serah terima"
            leftIcon={<HelpCircle size={22} color={colors.primary} />}
            onPress={() => router.push('/placeholder')}
            showChevron
          />
          <Divider />
          <ListItem
            title="Ketentuan & Syarat Driver"
            subtitle="Aturan pembatalan dan asuransi titipan"
            leftIcon={<FileText size={22} color={colors.primary} />}
            onPress={() => router.push('/placeholder')}
            showChevron
          />
        </View>

        {/* Logout Button */}
        <Button
          label="Keluar dari Akun"
          variant="ghost"
          size="lg"
          leftIcon={<LogOut size={18} color={colors.semantic.danger} />}
          onPress={() => setShowLogoutDialog(true)}
          style={styles.logoutBtn}
        />
      </ScrollView>

      {/* Logout Confirmation Dialog */}
      <Dialog
        visible={showLogoutDialog}
        title="Keluar dari Akun?"
        message="Anda akan keluar dari sesi ini dan perlu masuk kembali untuk menerima pesanan."
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        isDestructive
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutDialog(false)}
      />
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
  userCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statCol: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.borderLight,
  },
  switchCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xl,
  },
  logoutBtn: {
    marginBottom: spacing.xl,
  },
});
