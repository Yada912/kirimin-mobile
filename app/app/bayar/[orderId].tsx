import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreditCard, QrCode, Wallet, Banknote } from 'lucide-react-native';
import type { PaymentMethod } from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { Text, TopBar, Card, Button, PriceRow, SkeletonCard, ErrorState } from '../../src/ui';
import { useOrder, usePayOrder } from '../../src/api/hooks/useApi';
import { formatRupiah } from '../../src/utils/format';

export default function BayarScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const { data: order, isLoading } = useOrder(orderId);
  const { mutateAsync: payOrder, isPending } = usePayOrder();

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [payError, setPayError] = useState<string | null>(null);

  const handlePay = async () => {
    try {
      setPayError(null);
      await payOrder({ id: orderId, method });
      router.replace({ pathname: '/kirim/lacak/[id]', params: { id: orderId } });
    } catch (err: any) {
      setPayError(err.message || 'Pembayaran gagal diproses');
    }
  };

  if (isLoading || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Pembayaran" />
        <View style={styles.content}>
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  const methods: { id: PaymentMethod; label: string; desc: string; icon: any }[] = [
    {
      id: 'cash',
      label: 'Tunai saat Penjemputan / Pengantaran',
      desc: 'Bayar langsung ke pengemudi',
      icon: Banknote,
    },
    {
      id: 'qris',
      label: 'QRIS',
      desc: 'Scan dari GoPay, OVO, BCA, Mandiri, dll.',
      icon: QrCode,
    },
    {
      id: 'ewallet',
      label: 'Dompet Digital (E-Wallet)',
      desc: 'GoPay, ShopeePay, DANA',
      icon: Wallet,
    },
    {
      id: 'bank_va',
      label: 'Virtual Account Bank',
      desc: 'BCA, Mandiri, BNI, BRI',
      icon: CreditCard,
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Metode Pembayaran (P1)" />

      <ScrollView contentContainerStyle={styles.content}>
        {payError && (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {payError}
            </Text>
          </Card>
        )}

        {/* Total Card */}
        <Card variant="flat" padding="lg" style={styles.totalCard}>
          <Text variant="captionMedium" color={colors.text.secondary}>
            Total yang Harus Dibayar
          </Text>
          <Text variant="largeTitle" color={colors.primary} weight="700" style={{ marginTop: 4 }}>
            {formatRupiah(order.price?.total)}
          </Text>
        </Card>

        {/* Methods */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Pilih Metode Pembayaran
          </Text>

          <View style={styles.methodList}>
            {methods.map((m) => {
              const isSelected = method === m.id;
              const IconComp = m.icon;

              return (
                <Card
                  key={m.id}
                  onPress={() => setMethod(m.id)}
                  variant={isSelected ? 'elevated' : 'outlined'}
                  padding="md"
                  style={[styles.methodCard, isSelected && styles.selectedMethod]}
                >
                  <View style={styles.methodRow}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: isSelected ? colors.primaryLight : colors.surfaceMuted },
                      ]}
                    >
                      <IconComp size={22} color={isSelected ? colors.primary : colors.text.secondary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text
                        variant="headline"
                        color={colors.text.primary}
                        weight={isSelected ? '700' : '500'}
                      >
                        {m.label}
                      </Text>
                      <Text variant="caption" color={colors.text.secondary}>
                        {m.desc}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>

        <Button
          label="Konfirmasi & Bayar"
          variant="primary"
          size="lg"
          loading={isPending}
          onPress={handlePay}
          style={styles.payBtn}
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
  totalCard: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  methodList: {
    gap: spacing.sm,
  },
  methodCard: {
    backgroundColor: colors.surface,
  },
  selectedMethod: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtn: {
    marginBottom: spacing.xl,
  },
});

