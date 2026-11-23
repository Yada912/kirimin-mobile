import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Bike, Check } from '../../src/ui/icons';
import type { Role } from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { Text, TopBar, Card, Button } from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';

export default function PilihPeranScreen() {
  const router = useRouter();
  const { activeRole, switchRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role>(activeRole);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await switchRole(selectedRole);
      if (selectedRole === 'driver') {
        router.replace('/(angkut)/beranda');
      } else {
        router.replace('/(kirim)/beranda');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah peran');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="" canGoBack={false} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="largeTitle" color={colors.laut} align="center">
            Mau apa hari ini?
          </Text>
          <Text variant="callout" color={colors.text.secondary} align="center" style={styles.sub}>
            Bisa diganti kapan saja dari Profil.
          </Text>
        </View>

        <View style={styles.cards}>
          <Card
            onPress={() => setSelectedRole('sender')}
            variant={selectedRole === 'sender' ? 'elevated' : 'outlined'}
            style={[
              styles.roleCard,
              selectedRole === 'sender' && styles.selectedCard,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                <Package size={28} color={colors.primary} />
              </View>
              {selectedRole === 'sender' && (
                <View style={styles.checkBadge}>
                  <Check size={16} color={colors.text.inverse} />
                </View>
              )}
            </View>
            <Text variant="headline" color={colors.text.primary} weight="700" style={styles.roleTitle}>
              Kirim paket
            </Text>
            <Text variant="callout" color={colors.text.secondary}>
              Titipkan barang ke pengendara yang lewat tujuanmu.
            </Text>
          </Card>

          <Card
            onPress={() => setSelectedRole('driver')}
            variant={selectedRole === 'driver' ? 'elevated' : 'outlined'}
            style={[
              styles.roleCard,
              selectedRole === 'driver' && styles.selectedCard,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: colors.sawahLight }]}>
                <Bike size={28} color={colors.sawah} />
              </View>
              {selectedRole === 'driver' && (
                <View style={styles.checkBadge}>
                  <Check size={16} color={colors.text.inverse} />
                </View>
              )}
            </View>
            <Text variant="headline" color={colors.text.primary} weight="700" style={styles.roleTitle}>
              Antar sambil jalan
            </Text>
            <Text variant="callout" color={colors.text.secondary}>
              Bawa titipan di rute harianmu dan dapat uang tambahan.
            </Text>
          </Card>
        </View>

        <Button
          label={selectedRole === 'driver' ? 'Lanjut sebagai pengemudi' : 'Lanjut sebagai pengirim'}
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleConfirm}
          style={styles.confirmBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  header: {
    marginVertical: spacing.md,
  },
  sub: {
    marginTop: spacing.xs,
  },
  cards: {
    gap: spacing.lg,
  },
  roleCard: {
    padding: spacing.xl,
    borderRadius: radii.xl,
  },
  selectedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: {
    marginBottom: spacing.xs,
  },
  confirmBtn: {
    marginBottom: spacing.md,
  },
});

