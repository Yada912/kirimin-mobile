import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, User, Package, Bike, CreditCard } from '../../src/ui/icons';
import type { PaymentMethod, TripMatch } from '@kirimin/shared';
import { PAYMENT_METHODS } from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  StepHeader,
  Card,
  Avatar,
  PriceRow,
  Button,
  ChipGroup,
  Divider,
} from '../../src/ui';
import { useCreateOrder } from '../../src/api/hooks/useApi';
import { KIRIM_STEPS, confirmPrice, orderPayload, readKirimDraft } from '../../src/features/kirim/draft';

export default function KirimKonfirmasiScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { mutateAsync: createOrder, isPending } = useCreateOrder();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [error, setError] = useState<string | null>(null);

  // Same reader/builders the contract tests use (src/features/kirim/draft.ts).
  const draft = readKirimDraft(params);
  const { pickup, dropoff, recipient, tripId } = draft;
  const matchData: TripMatch | null = draft.match;
  const price = confirmPrice(draft);

  const handleSubmit = async () => {
    try {
      setError(null);
      const newOrder = await createOrder(orderPayload(draft, paymentMethod));

      // Digital payment methods open the interactive payment screen first
      if (paymentMethod !== 'cash') {
        router.replace({ pathname: '/bayar/[orderId]', params: { orderId: newOrder.id } });
      } else if (tripId) {
        router.replace({ pathname: '/kirim/lacak/[id]', params: { id: newOrder.id } });
      } else {
        router.replace({ pathname: '/kirim/menunggu/[id]', params: { id: newOrder.id } });
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim pesanan');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Cek lalu kirim" />
      <StepHeader steps={KIRIM_STEPS} currentStep={4} />

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {error}
            </Text>
          </Card>
        )}

        {/* Driver Yang Dipilih */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Pengemudi
          </Text>
          <Card variant="outlined" padding="md" style={styles.driverCard}>
            {matchData ? (
              <View style={styles.driverRow}>
                <Avatar name={matchData.trip.driver.name} url={matchData.trip.driver.avatarUrl} size={48} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text variant="headline" color={colors.text.primary} weight="700">
                    {matchData.trip.driver.name}
                  </Text>
                  <Text variant="caption" color={colors.text.secondary}>
                    {matchData.trip.vehicle.type === 'mobil' ? 'Mobil' : 'Motor'} {matchData.trip.vehicle.plate}
                  </Text>
                  <Text variant="caption" color={colors.primary} weight="600" style={{ marginTop: 2 }}>
                    {matchData.kind === 'direct' ? 'Lewat rutemu' : 'Belok sedikit dari rutenya'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.openRow}>
                <Bike size={24} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text variant="headline" color={colors.text.primary} weight="700">
                    Semua pengemudi
                  </Text>
                  <Text variant="caption" color={colors.text.secondary}>
                    Siapa pun yang lewat rute ini bisa menerima paketmu.
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </View>

        {/* Ringkasan Rute */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Rute
          </Text>
          <Card variant="outlined" padding="md">
            <View style={styles.infoRow}>
              <MapPin size={18} color={colors.primary} />
              <View style={styles.infoCol}>
                <Text variant="caption" color={colors.text.muted}>
                  Jemput di
                </Text>
                <Text variant="calloutSemibold" color={colors.text.primary}>
                  {pickup?.label}
                </Text>
              </View>
            </View>

            <Divider style={{ marginVertical: spacing.sm }} />

            <View style={styles.infoRow}>
              <MapPin size={18} color={colors.semantic.success} />
              <View style={styles.infoCol}>
                <Text variant="caption" color={colors.text.muted}>
                  Antar ke {recipient?.name} ({recipient?.phone})
                </Text>
                <Text variant="calloutSemibold" color={colors.text.primary}>
                  {dropoff?.label}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Ringkasan Paket */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Paket
          </Text>
          <Card variant="outlined" padding="md">
            <View style={styles.packageRow}>
              <Text variant="callout" color={colors.text.secondary}>
                Isi dan ukuran
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary}>
                {params.category}, ukuran {params.size}
              </Text>
            </View>
            {params.notes ? (
              <View style={styles.packageRow}>
                <Text variant="callout" color={colors.text.secondary}>
                  Catatan
                </Text>
                <Text variant="callout" color={colors.text.primary} style={{ flex: 1, textAlign: 'right' }}>
                  {params.notes as string}
                </Text>
              </View>
            ) : null}
          </Card>
        </View>

        {/* Metode Pembayaran */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Bayar pakai
          </Text>
          <ChipGroup<PaymentMethod>
            items={[
              { value: 'cash', label: 'Tunai ke pengemudi' },
              { value: 'qris', label: 'QRIS' },
              { value: 'ewallet', label: 'E-Wallet' },
              { value: 'bank_va', label: 'Transfer bank' },
            ]}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </View>

        {/* Rincian Biaya */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Ongkos
          </Text>
          <Card variant="elevated" padding="lg">
            {price ? (
              <PriceRow fee={price.fee} serviceFee={price.serviceFee} total={price.total} />
            ) : (
              <Text variant="callout" color={colors.text.secondary}>
                Ongkos muncul setelah ada pengemudi yang menerima.
              </Text>
            )}
          </Card>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.bottomBar}>
        <Button
          label={tripId ? `Kirim ke ${matchData?.trip.driver.name.split(' ')[0] ?? 'pengemudi'}` : 'Kirim ke semua pengemudi'}
          variant="primary"
          size="lg"
          loading={isPending}
          onPress={handleSubmit}
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
    paddingBottom: 110,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
  },
  driverCard: {
    backgroundColor: colors.surface,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoCol: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  packageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
});

