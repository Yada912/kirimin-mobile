import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle } from 'lucide-react-native';
import { colors, spacing } from '../../../src/theme/tokens';
import { Text, TopBar, Card, Button, ChipGroup, TextField, SkeletonCard, ErrorState } from '../../../src/ui';
import { useOrder, useCancelOrder } from '../../../src/api/hooks/useApi';
import { formatRupiah } from '../../../src/utils/format';

const CANCEL_REASONS = [
  'Berubah pikiran',
  'Salah memasukkan alamat jemput / antar',
  'Driver terlalu lama merespon',
  'Sudah menemukan kurir lain',
  'Lainnya',
];

export default function KirimBatalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isError, error } = useOrder(id);
  const { mutateAsync: cancelOrder, isPending } = useCancelOrder();

  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [customNote, setCustomNote] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Batalkan Pesanan" />
        <View style={styles.content}>
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Batalkan Pesanan" />
        <ErrorState message={(error as any)?.message || 'Pesanan tidak ditemukan'} />
      </SafeAreaView>
    );
  }

  const isAccepted = order.status === 'accepted';
  const refundText = isAccepted
    ? 'Karena driver sudah menerima pesanan, pembatalan dikenakan biaya kompensasi Rp 2.000 untuk pengemudi.'
    : 'Pesanan belum diterima pengemudi, dana akan dikembalikan penuh (100%).';

  const handleConfirmCancel = async () => {
    try {
      setCancelError(null);
      const fullReason = reason === 'Lainnya' ? customNote : reason;
      await cancelOrder({ id: order.id, reason: fullReason });
      router.replace('/(kirim)/aktivitas');
    } catch (err: any) {
      setCancelError(err.message || 'Gagal membatalkan pesanan.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Batalkan Pesanan (S7)" />

      <ScrollView contentContainerStyle={styles.content}>
        {cancelError && (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {cancelError}
            </Text>
          </Card>
        )}

        <Card variant="flat" padding="lg" style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <AlertTriangle size={24} color={colors.semantic.warning} />
            <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginLeft: spacing.sm }}>
              Konfirmasi Pembatalan
            </Text>
          </View>
          <Text variant="callout" color={colors.text.secondary} style={{ marginTop: spacing.xs }}>
            {refundText}
          </Text>
        </Card>

        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Pilih Alasan Pembatalan
          </Text>
          <ChipGroup<string>
            items={CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
            value={reason}
            onChange={setReason}
          />
        </View>

        {reason === 'Lainnya' && (
          <View style={styles.section}>
            <TextField
              label="Alasan Lainnya"
              placeholder="Tuliskan alasan pembatalan..."
              value={customNote}
              onChangeText={setCustomNote}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        <Button
          label="Ya, Batalkan Pesanan Ini"
          variant="danger"
          size="lg"
          loading={isPending}
          onPress={handleConfirmCancel}
          style={styles.btnCancel}
        />
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
    padding: spacing.lg,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  warningCard: {
    backgroundColor: colors.semantic.warningLight,
    marginBottom: spacing.lg,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  btnCancel: {
    marginTop: spacing.md,
  },
});

