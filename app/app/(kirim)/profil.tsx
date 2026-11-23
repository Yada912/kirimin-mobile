import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bike,
  ShieldCheck,
  HelpCircle,
  FileText,
  LogOut,
  SlidersHorizontal,
  Bookmark,
  UserCog,
  Radio,
} from '../../src/ui/icons';
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
  ServerSettingsSheet,
} from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';

export default function KirimProfilScreen() {
  const router = useRouter();
  const { user, logout, switchRole } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleSwitchRole = async () => {
    try {
      setSwitching(true);
      await switchRole('driver');
      router.replace('/(angkut)/beranda');
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

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Profil" canGoBack={false} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <Card variant="elevated" padding="lg" style={styles.userCard}>
          <View style={styles.userRow}>
            <Avatar name={user?.name || 'User'} url={user?.avatarUrl} size={60} />
            <View style={styles.userInfo}>
              <Text variant="title" color={colors.text.primary} weight="700">
                {user?.name || 'Pengguna Kirimin'}
              </Text>
              <Text variant="callout" color={colors.text.secondary}>
                {user?.phone}
              </Text>
              {user?.verified && (
                <View style={styles.verifiedRow}>
                  <ShieldCheck size={14} color={colors.semantic.success} />
                  <Text variant="captionMedium" color={colors.semantic.success} style={{ marginLeft: 4 }}>
                    KTP Terverifikasi
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Divider style={{ marginVertical: spacing.md }} />

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text variant="headline" color={colors.primary} weight="700">
                {user?.sendsCount ?? 0}
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Paket Dikirim
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
          </View>
        </Card>

        {/* Switch Role Card */}
        <Card variant="flat" padding="md" style={styles.switchCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchIcon}>
              <Bike size={24} color={colors.semantic.success} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="headline" color={colors.text.primary} weight="600">
                Mau sekalian antar paket?
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                Pasang rute harianmu dan dapat uang tambahan.
              </Text>
            </View>
          </View>
          <Button
            label="Ganti ke pengemudi"
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
            title="Ubah profil"
            subtitle="Nama, kendaraan, KTP, notifikasi"
            leftIcon={<UserCog size={22} color={colors.primary} />}
            onPress={() => router.push('/kelola/profil')}
            showChevron
          />
          <Divider />
          <ListItem
            title="Rute favorit"
            subtitle="Rute yang sering kamu pakai"
            leftIcon={<SlidersHorizontal size={22} color={colors.accent.coral} />}
            onPress={() => router.push('/kelola/preset')}
            showChevron
          />
          <Divider />
          <ListItem
            title="Alamat tersimpan"
            subtitle="Rumah, kos, kampus, kantor"
            leftIcon={<Bookmark size={22} color={colors.accent.violet} />}
            onPress={() => router.push('/kelola/lokasi')}
            showChevron
          />
          <Divider />
          <ListItem
            title="Alamat server"
            subtitle="Sambungkan ke server di PC atau tunnel"
            leftIcon={<Radio size={22} color={colors.primary} />}
            onPress={() => setShowServer(true)}
            showChevron
          />
          <Divider />
          <ListItem
            title="Bantuan"
            subtitle="Pertanyaan yang sering ditanyakan"
            leftIcon={<HelpCircle size={22} color={colors.primary} />}
            onPress={() => router.push({ pathname: '/placeholder', params: { topic: 'bantuan' } })}
            showChevron
          />
          <Divider />
          <ListItem
            title="Ketentuan dan privasi"
            subtitle="Cara kami menjaga datamu"
            leftIcon={<FileText size={22} color={colors.primary} />}
            onPress={() => router.push({ pathname: '/placeholder', params: { topic: 'privasi' } })}
            showChevron
          />
        </View>

        {/* Logout Button */}
        <Button
          label="Keluar"
          variant="ghost"
          size="lg"
          leftIcon={<LogOut size={18} color={colors.semantic.danger} />}
          onPress={() => setShowLogoutDialog(true)}
          style={styles.logoutBtn}
        />
      </ScrollView>

      <ServerSettingsSheet visible={showServer} onClose={() => setShowServer(false)} />

      {/* Logout Confirmation Dialog */}
      <Dialog
        visible={showLogoutDialog}
        title="Keluar dari akun?"
        message="Kamu perlu masuk lagi dengan nomor HP."
        confirmLabel="Keluar"
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
    backgroundColor: '#DCFCE7',
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

