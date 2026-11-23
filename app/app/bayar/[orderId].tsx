import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CreditCard,
  QrCode,
  Wallet,
  Banknote,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import type { PaymentMethod } from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Button,
  SkeletonCard,
  QrCodeMatrix,
  ChipGroup,
} from '../../src/ui';
import { useOrder, usePayOrder } from '../../src/api/hooks/useApi';
import { formatRupiah } from '../../src/utils/format';

const EWALLET_PROVIDERS = [
  { id: 'GoPay', scheme: 'gojek://', prefix: '70001' },
  { id: 'ShopeePay', scheme: 'shopeeid://', prefix: '89308' },
  { id: 'DANA', scheme: 'dana://', prefix: '85280' },
  { id: 'OVO', scheme: 'ovo://', prefix: '39358' },
] as const;

const BANK_PROVIDERS = [
  { id: 'BCA', code: '3901' },
  { id: 'Mandiri', code: '89508' },
  { id: 'BNI', code: '8810' },
  { id: 'BRI', code: '88810' },
] as const;

export default function BayarScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const { data: order, isLoading } = useOrder(orderId);
  const { mutateAsync: payOrder, isPending } = usePayOrder();

  const [method, setMethod] = useState<PaymentMethod>('qris');
  const [ewallet, setEwallet] = useState<string>('GoPay');
  const [bank, setBank] = useState<string>('BCA');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [txState, setTxState] = useState<'idle' | 'pending' | 'success'>('idle');
  const [payError, setPayError] = useState<string | null>(null);

  const numericRef = useMemo(() => {
    const raw = (order?.code || orderId || '123456').replace(/\D/g, '');
    return (raw + '0812345678').slice(0, 10);
  }, [order?.code, orderId]);

  const paymentCode = useMemo(() => {
    if (method === 'ewallet') {
      const p = EWALLET_PROVIDERS.find((x) => x.id === ewallet) || EWALLET_PROVIDERS[0];
      return `${p.prefix}${numericRef}`;
    }
    if (method === 'bank_va') {
      const b = BANK_PROVIDERS.find((x) => x.id === bank) || BANK_PROVIDERS[0];
      return `${b.code}${numericRef}`;
    }
    return `ID.KIRIMIN.QRIS.${order?.code || orderId}`;
  }, [method, ewallet, bank, numericRef, order?.code, orderId]);

  const handleCopy = async (text: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2200);
    } catch {
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2200);
    }
  };

  const handleOpenExternalWallet = async () => {
    setTxState('pending');
    await handleCopy(paymentCode);
    const provider = EWALLET_PROVIDERS.find((x) => x.id === ewallet);
    if (provider) {
      try {
        const can = await Linking.canOpenURL(provider.scheme);
        if (can) {
          await Linking.openURL(provider.scheme);
          return;
        }
      } catch {
        // Fallback: keep pending state in-app so user can confirm after paying
      }
    }
  };

  const handlePay = async () => {
    try {
      setPayError(null);
      await payOrder({ id: orderId, method });
      setTxState('success');
      if (order?.tripId) {
        router.replace({ pathname: '/kirim/lacak/[id]', params: { id: orderId } });
      } else {
        router.replace({ pathname: '/kirim/menunggu/[id]', params: { id: orderId } });
      }
    } catch (err: any) {
      setPayError(err.message || 'Pembayaran gagal diproses');
    }
  };

  const handleDefer = () => {
    if (order?.tripId) {
      router.replace({ pathname: '/kirim/lacak/[id]', params: { id: orderId } });
    } else {
      router.replace({ pathname: '/kirim/menunggu/[id]', params: { id: orderId } });
    }
  };

  if (isLoading || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Metode Pembayaran" />
        <View style={styles.content}>
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  const methods: { id: PaymentMethod; label: string; desc: string; icon: any }[] = [
    {
      id: 'qris',
      label: 'QRIS',
      desc: 'Scan dari GoPay, OVO, DANA, atau M-Banking',
      icon: QrCode,
    },
    {
      id: 'ewallet',
      label: 'Dompet Digital (E-Wallet)',
      desc: 'GoPay, ShopeePay, DANA, OVO',
      icon: Wallet,
    },
    {
      id: 'bank_va',
      label: 'Virtual Account Bank',
      desc: 'BCA, Mandiri, BNI, BRI',
      icon: CreditCard,
    },
    {
      id: 'cash',
      label: 'Tunai ke Driver',
      desc: 'Bayar langsung saat penjemputan atau pengantaran',
      icon: Banknote,
    },
  ];

  const isAlreadyPaid = order.payment?.status === 'paid';

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Metode Pembayaran" subtitle={order.code} />

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
          <View style={styles.totalHeader}>
            <View>
              <Text variant="captionMedium" color={colors.text.secondary}>
                Total Tagihan
              </Text>
              <Text variant="largeTitle" color={colors.primary} weight="700" style={{ marginTop: 2 }}>
                {formatRupiah(order.price?.total)}
              </Text>
            </View>
            <View
              style={[
                styles.paidBadge,
                { backgroundColor: isAlreadyPaid ? colors.semantic.successLight : colors.semantic.warningLight },
              ]}
            >
              <Text
                variant="captionMedium"
                color={isAlreadyPaid ? colors.semantic.success : colors.semantic.warning}
                weight="700"
              >
                {isAlreadyPaid ? 'Lunas' : 'Belum Dibayar'}
              </Text>
            </View>
          </View>
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
                  onPress={() => {
                    setMethod(m.id);
                    setTxState('idle');
                  }}
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
                      <Text variant="headline" color={colors.text.primary} weight="600">
                        {m.label}
                      </Text>
                      <Text variant="caption" color={colors.text.secondary}>
                        {m.desc}
                      </Text>
                    </View>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>

        {/* Interactive Payment Details */}
        {method === 'qris' && (
          <Card variant="outlined" padding="lg" style={styles.detailCard}>
            <Text variant="headline" color={colors.text.primary} weight="700" align="center">
              Scan Kode QRIS Kirimin
            </Text>
            <Text variant="caption" color={colors.text.secondary} align="center" style={{ marginTop: 4, marginBottom: spacing.md }}>
              NMID: ID1026000019283 • Kirimin Bali
            </Text>
            <QrCodeMatrix payload={`000201010212KIRIMIN${order.id}${order.price?.total || 0}`} size={172} />
            <Text variant="caption" color={colors.text.muted} align="center" style={{ marginTop: spacing.md }}>
              Buka aplikasi e-wallet atau M-Banking Anda, lalu scan QR di atas.
            </Text>
          </Card>
        )}

        {method === 'ewallet' && (
          <Card variant="outlined" padding="lg" style={styles.detailCard}>
            <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginBottom: spacing.sm }}>
              Pilih Aplikasi E-Wallet
            </Text>
            <ChipGroup<string>
              items={EWALLET_PROVIDERS.map((p) => ({ value: p.id, label: p.id }))}
              value={ewallet}
              onChange={setEwallet}
            />

            <View style={styles.codeBox}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={colors.text.secondary}>
                  Kode Pembayaran {ewallet}
                </Text>
                <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginTop: 2 }}>
                  {paymentCode}
                </Text>
              </View>
              <Pressable onPress={() => handleCopy(paymentCode)} style={styles.copyBtn}>
                {copiedText === paymentCode ? (
                  <Check size={16} color={colors.semantic.success} />
                ) : (
                  <Copy size={16} color={colors.primary} />
                )}
                <Text
                  variant="captionMedium"
                  color={copiedText === paymentCode ? colors.semantic.success : colors.primary}
                  weight="700"
                  style={{ marginLeft: 4 }}
                >
                  {copiedText === paymentCode ? 'Disalin' : 'Salin'}
                </Text>
              </Pressable>
            </View>

            <Button
              label={`Buka ${ewallet} Sekarang`}
              variant="outline"
              size="md"
              leftIcon={<ExternalLink size={16} color={colors.primary} />}
              onPress={handleOpenExternalWallet}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        )}

        {method === 'bank_va' && (
          <Card variant="outlined" padding="lg" style={styles.detailCard}>
            <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginBottom: spacing.sm }}>
              Pilih Bank Virtual Account
            </Text>
            <ChipGroup<string>
              items={BANK_PROVIDERS.map((b) => ({ value: b.id, label: b.id }))}
              value={bank}
              onChange={setBank}
            />

            <View style={styles.codeBox}>
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={colors.text.secondary}>
                  Nomor Virtual Account {bank}
                </Text>
                <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginTop: 2 }}>
                  {paymentCode}
                </Text>
              </View>
              <Pressable onPress={() => handleCopy(paymentCode)} style={styles.copyBtn}>
                {copiedText === paymentCode ? (
                  <Check size={16} color={colors.semantic.success} />
                ) : (
                  <Copy size={16} color={colors.primary} />
                )}
                <Text
                  variant="captionMedium"
                  color={copiedText === paymentCode ? colors.semantic.success : colors.primary}
                  weight="700"
                  style={{ marginLeft: 4 }}
                >
                  {copiedText === paymentCode ? 'Disalin' : 'Salin'}
                </Text>
              </Pressable>
            </View>

            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: spacing.sm }}>
              Transfer sesuai total tagihan melalui M-Banking {bank} → Transfer Virtual Account.
            </Text>
          </Card>
        )}

        {method === 'cash' && (
          <Card variant="flat" padding="md" style={styles.cashCard}>
            <Text variant="calloutSemibold" color={colors.text.primary}>
              Pembayaran Tunai Langsung
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 4 }}>
              Siapkan uang pas sebesar {formatRupiah(order.price?.total)} untuk diserahkan kepada pengemudi saat penjemputan atau serah terima paket.
            </Text>
          </Card>
        )}

        {/* Payment Transaction Listener Status */}
        {txState === 'pending' && (
          <Card variant="flat" padding="md" style={styles.pendingCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Clock size={18} color={colors.semantic.warning} />
              <Text variant="calloutSemibold" color={colors.semantic.warning} style={{ marginLeft: 8 }}>
                Menunggu Konfirmasi Pembayaran
              </Text>
            </View>
            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 4 }}>
              Setelah menyelesaikan pembayaran di aplikasi {ewallet}, ketuk tombol "Konfirmasi Sudah Bayar" di bawah.
            </Text>
          </Card>
        )}

        {txState === 'success' && (
          <Card variant="flat" padding="md" style={styles.successCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CheckCircle2 size={18} color={colors.semantic.success} />
              <Text variant="calloutSemibold" color={colors.semantic.success} style={{ marginLeft: 8 }}>
                Pembayaran Berhasil Diverifikasi
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label={method === 'cash' ? 'Konfirmasi Bayar Tunai' : 'Konfirmasi Sudah Bayar'}
          variant="primary"
          size="lg"
          loading={isPending}
          onPress={handlePay}
        />
        <Button
          label="Bayar Nanti"
          variant="ghost"
          size="md"
          onPress={handleDefer}
          style={{ marginTop: spacing.xs }}
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
  content: {
    padding: spacing.lg,
    paddingBottom: 148,
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
  totalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paidBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
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
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  detailCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  cashCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  pendingCard: {
    backgroundColor: colors.semantic.warningLight,
    marginBottom: spacing.md,
  },
  successCard: {
    backgroundColor: colors.semantic.successLight,
    marginBottom: spacing.md,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
});
