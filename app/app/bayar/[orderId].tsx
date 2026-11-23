import React, { useEffect, useMemo, useState } from 'react';
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
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  FlaskConical,
  ArrowRight,
} from 'lucide-react-native';
import type { PaymentChannel, PaymentMethod, PaymentTransaction } from '@kirimin/shared';
import { PAYMENT_CHANNEL_LABELS, PAYMENT_TX_LABELS } from '@kirimin/shared';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Button,
  SkeletonCard,
  QrCodeMatrix,
  ChipGroup,
  Divider,
  HandoverSparkArt,
  BrandLogo,
} from '../../src/ui';
import {
  useOrder,
  useOrderPayment,
  useCreatePaymentIntent,
  useSimulatePaymentWebhook,
  usePayOrder,
} from '../../src/api/hooks/useApi';
import { formatDateTime, formatRupiah } from '../../src/utils/format';

const EWALLET_CHANNELS: { id: PaymentChannel; label: string }[] = [
  { id: 'gopay', label: 'GoPay' },
  { id: 'shopeepay', label: 'ShopeePay' },
  { id: 'dana', label: 'DANA' },
  { id: 'ovo', label: 'OVO' },
];

const BANK_CHANNELS: { id: PaymentChannel; label: string }[] = [
  { id: 'bca', label: 'BCA' },
  { id: 'mandiri', label: 'Mandiri' },
  { id: 'bni', label: 'BNI' },
  { id: 'bri', label: 'BRI' },
];

function formatCountdown(expiresAt: string, nowMs: number): { text: string; expired: boolean } {
  const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - nowMs) / 1000));
  if (diff <= 0) return { text: '00:00', expired: true };
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    text: h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`,
    expired: false,
  };
}

export default function BayarScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const { data: order, isLoading: orderLoading, refetch: refetchOrder } = useOrder(orderId);
  const { data: latestTx, isLoading: txLoading, refetch: refetchTx } = useOrderPayment(orderId);
  const { mutateAsync: createIntent, isPending: creatingIntent } = useCreatePaymentIntent();
  const { mutateAsync: simulateWebhook, isPending: simulating } = useSimulatePaymentWebhook();
  const { mutateAsync: payOrderCash, isPending: payingCash } = usePayOrder();

  const [method, setMethod] = useState<PaymentMethod>('qris');
  const [ewalletChannel, setEwalletChannel] = useState<PaymentChannel>('gopay');
  const [bankChannel, setBankChannel] = useState<PaymentChannel>('bca');
  const [choosingMethod, setChoosingMethod] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [attemptSeq, setAttemptSeq] = useState(1);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Sync default method from order on initial load
  useEffect(() => {
    if (order?.payment?.method && !latestTx) {
      setMethod(order.payment.method);
    }
  }, [order?.payment?.method, latestTx]);

  // Live 1-second countdown timer while a pending gateway invoice is open
  useEffect(() => {
    if (!latestTx || latestTx.status !== 'pending') return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [latestTx?.status, latestTx?.id]);

  const selectedChannel: PaymentChannel = useMemo(() => {
    if (method === 'ewallet') return ewalletChannel;
    if (method === 'bank_va') return bankChannel;
    if (method === 'qris') return 'qris';
    return 'cash';
  }, [method, ewalletChannel, bankChannel]);

  const handleCopy = async (text: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // fallback toast still shown
    }
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2200);
  };

  const navigateToTracking = () => {
    if (order?.tripId) {
      router.replace({ pathname: '/kirim/lacak/[id]', params: { id: orderId } });
    } else {
      router.replace({ pathname: '/kirim/menunggu/[id]', params: { id: orderId } });
    }
  };

  const handleCreateCharge = async () => {
    try {
      setPayError(null);
      if (method === 'cash') {
        await payOrderCash({ id: orderId, method: 'cash' });
        await refetchOrder();
        navigateToTracking();
        return;
      }

      const idempotencyKey = `krm-${orderId}-${method}-${selectedChannel}-${attemptSeq}`;
      await createIntent({
        orderId,
        method,
        channel: selectedChannel,
        idempotencyKey,
      });
      setChoosingMethod(false);
    } catch (err: any) {
      setPayError(err.message || 'Gagal membuat tagihan pembayaran gateway');
    }
  };

  const handleSimulateOutcome = async (
    tx: PaymentTransaction,
    outcome: 'settlement' | 'expire' | 'failure',
  ) => {
    try {
      setPayError(null);
      await simulateWebhook({
        paymentId: tx.id,
        outcome,
        ...(outcome === 'failure'
          ? { failureReason: 'Pembayaran ditolak penyedia dana (Simulasi Sandbox)' }
          : {}),
      });
      await Promise.all([refetchTx(), refetchOrder()]);
      if (outcome !== 'settlement') {
        setAttemptSeq((n) => n + 1);
      }
    } catch (err: any) {
      setPayError(err.message || 'Gagal memproses callback webhook');
    }
  };

  const handleOpenDeepLink = async (url?: string) => {
    if (!url) return;
    await handleCopy(url);
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch {
      // sandbox fallback stays in app
    }
  };

  if (orderLoading || txLoading || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Pembayaran Gateway" />
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  const isPaid = order.payment?.status === 'paid' || latestTx?.status === 'settlement';
  const activePendingTx = !choosingMethod && latestTx?.status === 'pending' ? latestTx : null;
  const lastFailedOrExpiredTx =
    !isPaid && !activePendingTx && latestTx && ['expired', 'failed'].includes(latestTx.status)
      ? latestTx
      : null;

  // ─── VIEW 1: DIGITAL RECEIPT (SETTLED / PAID) ─────────────────────────────
  if (isPaid) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Struk Pembayaran" subtitle={order.code} />
        <ScrollView contentContainerStyle={styles.content}>
          <Card variant="elevated" padding="xl" style={styles.receiptCard}>
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <BrandLogo size="sm" variant="tile" style={{ alignSelf: 'center', marginBottom: spacing.sm }} />
              <HandoverSparkArt width={76} height={76} />
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={13} color={colors.driverDeep} />
                <Text variant="captionMedium" color={colors.driverDeep} weight="700" style={{ marginLeft: 4 }}>
                  TERVERIFIKASI WEBHOOK GATEWAY
                </Text>
              </View>
              <Text variant="title" color={colors.text.primary} weight="700" style={{ marginTop: spacing.sm }}>
                Pembayaran Lunas!
              </Text>
              <Text variant="largeTitle" color={colors.driver} weight="700" style={{ marginTop: 4 }}>
                {formatRupiah(latestTx?.amount ?? order.price?.total)}
              </Text>
            </View>

            <Divider style={{ marginVertical: spacing.md }} />

            <View style={styles.receiptRow}>
              <Text variant="caption" color={colors.text.secondary}>
                Nomor Pesanan
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary}>
                {order.code}
              </Text>
            </View>
            {latestTx ? (
              <>
                <View style={styles.receiptRow}>
                  <Text variant="caption" color={colors.text.secondary}>
                    Referensi Gateway
                  </Text>
                  <Text variant="captionMedium" color={colors.text.primary} weight="700" style={{ marginLeft: spacing.md, flexShrink: 1, textAlign: 'right' }}>
                    {latestTx.gatewayRef}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text variant="caption" color={colors.text.secondary}>
                    Channel Pembayaran
                  </Text>
                  <Text variant="captionMedium" color={colors.text.primary} weight="700" style={{ marginLeft: spacing.md, flexShrink: 1, textAlign: 'right' }}>
                    {PAYMENT_CHANNEL_LABELS[latestTx.channel]}
                  </Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text variant="caption" color={colors.text.secondary}>
                    Waktu Lunas
                  </Text>
                  <Text variant="captionMedium" color={colors.text.primary}>
                    {formatDateTime(latestTx.paidAt || latestTx.updatedAt)}
                  </Text>
                </View>
              </>
            ) : null}

            <Button
              label="Lacak Pesanan Sekarang"
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight size={17} color="#FFF" />}
              onPress={navigateToTracking}
              style={{ marginTop: spacing.lg, backgroundColor: colors.driver }}
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── VIEW 2: ACTIVE PENDING GATEWAY INVOICE (LIVE COUNTDOWN + WEBHOOK) ────
  if (activePendingTx) {
    const countdown = formatCountdown(activePendingTx.expiresAt, nowMs);

    return (
      <SafeAreaView style={styles.safe}>
        <TopBar
          title="Selesaikan Pembayaran"
          subtitle={`${PAYMENT_CHANNEL_LABELS[activePendingTx.channel]}`}
          rightAction={
            <Pressable
              onPress={() => {
                setChoosingMethod(true);
                setAttemptSeq((n) => n + 1);
              }}
              style={styles.switchMethodPill}
            >
              <Text variant="captionMedium" color={colors.primary} weight="700">
                Ganti
              </Text>
            </Pressable>
          }
        />

        <ScrollView contentContainerStyle={styles.content}>
          {payError ? (
            <Card variant="flat" padding="md" style={styles.errorCard}>
              <Text variant="callout" color={colors.semantic.danger}>
                {payError}
              </Text>
            </Card>
          ) : null}

          {/* Invoice Header & Live Countdown Timer */}
          <View style={styles.invoiceBanner}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="#DBEAFE">
                Total Tagihan ({order.code})
              </Text>
              <Text variant="largeTitle" color="#FFFFFF" weight="700" style={{ marginTop: 2 }}>
                {formatRupiah(activePendingTx.amount)}
              </Text>
              <Text variant="caption" color="#BFDBFE" style={{ marginTop: 4 }}>
                Ref: {activePendingTx.gatewayRef}
              </Text>
            </View>
            <View style={styles.timerBox}>
              <Clock size={13} color="#FEF08A" />
              <Text variant="caption" color="#FEF08A" weight="700" style={{ marginTop: 2, fontSize: 10 }}>
                BATAS WAKTU
              </Text>
              <Text variant="headline" color="#FFFFFF" weight="700">
                {countdown.text}
              </Text>
            </View>
          </View>

          {/* Instrument Card: QRIS / Bank VA / E-Wallet */}
          <Card variant="elevated" padding="lg" style={styles.instrumentCard}>
            <View style={styles.instrumentHeader}>
              <Text variant="headline" color={colors.text.primary} weight="700">
                {PAYMENT_CHANNEL_LABELS[activePendingTx.channel]}
              </Text>
              <View style={styles.pendingPill}>
                <Text variant="caption" color={colors.semantic.warning} weight="700">
                  {PAYMENT_TX_LABELS[activePendingTx.status]}
                </Text>
              </View>
            </View>

            {/* EMVCo Dynamic QRIS */}
            {activePendingTx.method === 'qris' && activePendingTx.instructions.qrString ? (
              <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
                <QrCodeMatrix payload={activePendingTx.instructions.qrString} size={184} />
                <Text variant="caption" color={colors.text.muted} style={{ marginTop: spacing.xs }}>
                  Merchant: {activePendingTx.instructions.accountName || 'KIRIMIN BALI'}
                </Text>
                <Pressable
                  onPress={() => handleCopy(activePendingTx.instructions.qrString!)}
                  style={styles.copyCodeBtn}
                >
                  {copiedText === activePendingTx.instructions.qrString ? (
                    <Check size={14} color={colors.driver} />
                  ) : (
                    <Copy size={14} color={colors.primary} />
                  )}
                  <Text
                    variant="captionMedium"
                    color={copiedText === activePendingTx.instructions.qrString ? colors.driver : colors.primary}
                    weight="700"
                    style={{ marginLeft: 5 }}
                  >
                    {copiedText === activePendingTx.instructions.qrString
                      ? 'Payload QRIS Disalin'
                      : 'Salin Payload QRIS (EMVCo)'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Virtual Account */}
            {activePendingTx.method === 'bank_va' && activePendingTx.instructions.vaNumber ? (
              <View style={styles.codeBox}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={colors.text.muted}>
                    Nomor Virtual Account
                  </Text>
                  <Text variant="title" color={colors.text.primary} weight="700" style={{ letterSpacing: 1 }}>
                    {activePendingTx.instructions.vaNumber}
                  </Text>
                  <Text variant="caption" color={colors.text.secondary}>
                    a.n. {activePendingTx.instructions.accountName}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleCopy(activePendingTx.instructions.vaNumber!)}
                  style={styles.copyPill}
                >
                  {copiedText === activePendingTx.instructions.vaNumber ? (
                    <Check size={15} color={colors.driver} />
                  ) : (
                    <Copy size={15} color={colors.primary} />
                  )}
                  <Text
                    variant="captionMedium"
                    color={copiedText === activePendingTx.instructions.vaNumber ? colors.driver : colors.primary}
                    weight="700"
                    style={{ marginLeft: 4 }}
                  >
                    {copiedText === activePendingTx.instructions.vaNumber ? 'Disalin' : 'Salin'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* E-Wallet Deep Link */}
            {activePendingTx.method === 'ewallet' ? (
              <View style={{ marginVertical: spacing.sm }}>
                <View style={styles.codeBox}>
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" color={colors.text.muted}>
                      Referensi Tagihan E-Wallet
                    </Text>
                    <Text variant="calloutSemibold" color={colors.text.primary}>
                      {activePendingTx.gatewayRef}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleCopy(activePendingTx.gatewayRef)}
                    style={styles.copyPill}
                  >
                    <Copy size={14} color={colors.primary} />
                    <Text variant="captionMedium" color={colors.primary} weight="700" style={{ marginLeft: 4 }}>
                      {copiedText === activePendingTx.gatewayRef ? 'Disalin' : 'Salin'}
                    </Text>
                  </Pressable>
                </View>
                <Button
                  label={`Buka Aplikasi ${PAYMENT_CHANNEL_LABELS[activePendingTx.channel]}`}
                  variant="outline"
                  size="md"
                  leftIcon={<ExternalLink size={15} color={colors.primary} />}
                  onPress={() => handleOpenDeepLink(activePendingTx.instructions.deepLinkUrl)}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            ) : null}

            {/* Step-by-step payment guide from gateway */}
            <Divider style={{ marginVertical: spacing.md }} />
            <Text variant="captionMedium" color={colors.text.secondary} weight="700" style={{ marginBottom: 6 }}>
              Cara Pembayaran:
            </Text>
            {activePendingTx.instructions.steps.map((step, i) => (
              <View key={i} style={styles.stepLine}>
                <View style={styles.stepNum}>
                  <Text variant="caption" color={colors.primary} weight="700" style={{ fontSize: 10 }}>
                    {i + 1}
                  </Text>
                </View>
                <Text variant="caption" color={colors.text.secondary} style={{ flex: 1, lineHeight: 18 }}>
                  {step}
                </Text>
              </View>
            ))}
          </Card>

          {/* SANDBOX GATEWAY SIMULATOR (Runs real SHA-512 signed webhook pipeline!) */}
          {activePendingTx.isSandbox ? (
            <Card variant="flat" padding="md" style={styles.sandboxCard}>
              <View style={styles.sandboxHeader}>
                <FlaskConical size={16} color={colors.accent.violet} />
                <Text variant="calloutSemibold" color={colors.accent.violet} style={{ marginLeft: 6 }}>
                  Simulator Payment Gateway (Sandbox)
                </Text>
              </View>
              <Text variant="caption" color={colors.text.secondary} style={{ marginBottom: spacing.md, lineHeight: 18 }}>
                Mengirim callback webhook bertanda tangan SHA-512 asli ke server (POST /webhooks/payments) dan memperbarui status secara realtime via SSE.
              </Text>

              <Button
                label="Simulasikan Bayar Berhasil (Settlement)"
                variant="primary"
                size="lg"
                loading={simulating}
                onPress={() => handleSimulateOutcome(activePendingTx, 'settlement')}
                style={{ backgroundColor: colors.driver }}
                testID="simulate-payment-settlement"
              />

              <View style={styles.sandboxSecondaryRow}>
                <Pressable
                  onPress={() => handleSimulateOutcome(activePendingTx, 'failure')}
                  disabled={simulating}
                  style={styles.sandboxFailBtn}
                >
                  <Text variant="captionMedium" color={colors.semantic.danger} weight="700">
                    Simulasi Gagal
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSimulateOutcome(activePendingTx, 'expire')}
                  disabled={simulating}
                  style={styles.sandboxExpireBtn}
                >
                  <Text variant="captionMedium" color={colors.semantic.warning} weight="700">
                    Simulasi Kedaluwarsa
                  </Text>
                </Pressable>
              </View>
            </Card>
          ) : null}

          <Button
            label="Cek Status Pembayaran"
            variant="ghost"
            size="md"
            leftIcon={<RefreshCw size={15} color={colors.primary} />}
            onPress={() => {
              refetchTx();
              refetchOrder();
            }}
            style={{ marginTop: spacing.xs }}
          />
          <Button
            label="Bayar Nanti"
            variant="ghost"
            size="sm"
            onPress={navigateToTracking}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── VIEW 3: CHOOSE PAYMENT METHOD & CHANNEL TO ISSUE GATEWAY CHARGE ──────
  const methods: { id: PaymentMethod; label: string; desc: string; icon: any }[] = [
    {
      id: 'qris',
      label: 'QRIS Dinamis',
      desc: 'Scan instan dari GoPay, DANA, OVO, atau M-Banking',
      icon: QrCode,
    },
    {
      id: 'ewallet',
      label: 'Dompet Digital (E-Wallet)',
      desc: 'GoPay, ShopeePay, DANA, OVO (Deep-Link)',
      icon: Wallet,
    },
    {
      id: 'bank_va',
      label: 'Virtual Account Bank',
      desc: 'BCA, Mandiri, BNI, BRI (Verifikasi Otomatis)',
      icon: CreditCard,
    },
    {
      id: 'cash',
      label: 'Tunai ke Driver (COD)',
      desc: 'Bayar langsung saat penjemputan atau serah terima',
      icon: Banknote,
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Pilih Pembayaran" subtitle={order.code} />

      <ScrollView contentContainerStyle={styles.content}>
        {payError ? (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {payError}
            </Text>
          </Card>
        ) : null}

        {lastFailedOrExpiredTx ? (
          <Card variant="flat" padding="md" style={styles.retryBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AlertTriangle size={16} color={colors.semantic.warning} />
              <Text variant="calloutSemibold" color={colors.semantic.warning} style={{ marginLeft: 6 }}>
                Tagihan Sebelumnya {PAYMENT_TX_LABELS[lastFailedOrExpiredTx.status]}
              </Text>
            </View>
            <Text variant="caption" color={colors.text.secondary} style={{ marginTop: 3 }}>
              Ref {lastFailedOrExpiredTx.gatewayRef} tidak berhasil diselesaikan. Silakan buat tagihan baru di bawah.
            </Text>
          </Card>
        ) : null}

        {/* Total Bill Banner */}
        <View style={styles.totalHero}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BrandLogo size="xs" variant="light" />
              <Text variant="caption" color="#DBEAFE">
                • Total Tagihan
              </Text>
            </View>
            <Text variant="largeTitle" color="#FFFFFF" weight="700" style={{ marginTop: 3 }}>
              {formatRupiah(order.price?.total)}
            </Text>
          </View>
          <View style={styles.gatewayPill}>
            <ShieldCheck size={13} color="#A7F3D0" />
            <Text variant="caption" color="#ECFDF5" weight="700" style={{ marginLeft: 4, fontSize: 10 }}>
              GATEWAY AMAN
            </Text>
          </View>
        </View>

        <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
          Metode Pembayaran
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
                    <IconComp size={20} color={isSelected ? colors.primary : colors.text.secondary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text variant="calloutSemibold" color={colors.text.primary}>
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

                {isSelected && m.id === 'ewallet' ? (
                  <View style={{ marginTop: spacing.md }}>
                    <ChipGroup<PaymentChannel>
                      items={EWALLET_CHANNELS.map((c) => ({ value: c.id, label: c.label }))}
                      value={ewalletChannel}
                      onChange={setEwalletChannel}
                    />
                  </View>
                ) : null}

                {isSelected && m.id === 'bank_va' ? (
                  <View style={{ marginTop: spacing.md }}>
                    <ChipGroup<PaymentChannel>
                      items={BANK_CHANNELS.map((c) => ({ value: c.id, label: c.label }))}
                      value={bankChannel}
                      onChange={setBankChannel}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label={
            method === 'cash'
              ? 'Konfirmasi Bayar Tunai ke Driver'
              : `Buat Tagihan ${PAYMENT_CHANNEL_LABELS[selectedChannel]}`
          }
          variant="primary"
          size="lg"
          loading={creatingIntent || payingCash}
          onPress={handleCreateCharge}
          testID="create-payment-intent-btn"
        />
        <Button
          label="Bayar Nanti"
          variant="ghost"
          size="sm"
          onPress={navigateToTracking}
          style={{ marginTop: 4 }}
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
    padding: spacing.md,
    paddingBottom: 140,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  retryBanner: {
    backgroundColor: colors.semantic.warningLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: spacing.md,
  },
  totalHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  gatewayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  switchMethodPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  invoiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.float,
  },
  timerBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  instrumentCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  instrumentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pendingPill: {
    backgroundColor: colors.semantic.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    marginTop: spacing.sm,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    marginLeft: spacing.sm,
  },
  stepLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  sandboxCard: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD',
    marginBottom: spacing.md,
  },
  sandboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sandboxSecondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sandboxFailBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: colors.semantic.dangerLight,
  },
  sandboxExpireBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: colors.semantic.warningLight,
  },
  receiptCard: {
    backgroundColor: colors.surface,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.driverLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: spacing.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
