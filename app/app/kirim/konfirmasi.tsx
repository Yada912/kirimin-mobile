import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, User, Package, Bike, CreditCard } from 'lucide-react-native';
import type { PaymentMethod, TripMatch, Order } from '@kirimin/shared';
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

export default function KirimKonfirmasiScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { mutateAsync: createOrder, isPending } = useCreateOrder();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [error, setError] = useState<string | null>(null);

  const pickup = params.pickup ? JSON.parse(params.pickup as string) : null;
  const dropoff = params.dropoff ? JSON.parse(params.dropoff as string) : null;
  const recipient = params.recipient ? JSON.parse(params.recipient as string) : null;
  const handling = params.handling ? JSON.parse(params.handling as string) : [];
  const matchData: TripMatch | null = params.matchData ? JSON.parse(params.matchData as string) : null;
  const tripId = params.tripId ? (params.tripId as string) : undefined;

  const fee = matchData?.price?.fee ?? 10000;
  const serviceFee = matchData?.price?.serviceFee ?? 2000;
  const total = matchData?.price?.total ?? 12000;

  const handleSubmit = async () => {
    try {
      setError(null);
      const payload: any = {
        category: params.category,
        size: params.size,
        weightClass: params.weightClass,
        handling,
        photoUrl: params.photoUrl ? (params.photoUrl as string) : null,
        notes: (params.notes as string) || '',
        pickup,
        dropoff,
        recipient,
        handoverMethod: params.handoverMethod || 'meet',
        paymentMethod,
      };

      if (tripId) {
        payload.tripId = tripId;
      }

      const newOrder = await createOrder(payload);

      // If sent with tripId -> S5 lacak; if open request -> S6 menunggu
      if (tripId) {
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
      <TopBar title="Tinjau & Konfirmasi (S4)" />
      <StepHeader
        steps={['Paket', 'Rute', 'Driver', 'Konfirmasi']}
        currentStep={4}
      />

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
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Pengemudi yang Dituju
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
                    Kendaraan: {matchData.trip.vehicle.plate} ({matchData.trip.vehicle.type})
                  </Text>
                  <Text variant="caption" color={colors.primary} weight="600" style={{ marginTop: 2 }}>
                    {matchData.kind === 'direct' ? 'Rute Langsung' : 'Dengan Simpangan'} • {Math.round(matchData.similarity * 100)}% searah
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.openRow}>
                <Bike size={24} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text variant="headline" color={colors.text.primary} weight="700">
                    Permintaan Terbuka
                  </Text>
                  <Text variant="caption" color={colors.text.secondary}>
                    Akan dikirim ke semua pengemudi yang melewati rute ini.
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </View>

        {/* Ringkasan Rute */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Rute Pengiriman
          </Text>
          <Card variant="outlined" padding="md">
            <View style={styles.infoRow}>
              <MapPin size={18} color={colors.primary} />
              <View style={styles.infoCol}>
                <Text variant="caption" color={colors.text.muted}>
                  Titik Jemput
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
                  Titik Antar (Penerima: {recipient?.name} - {recipient?.phone})
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
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Paket
          </Text>
          <Card variant="outlined" padding="md">
            <View style={styles.packageRow}>
              <Text variant="callout" color={colors.text.secondary}>
                Kategori / Ukuran:
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary}>
                {params.category} • Ukuran {params.size}
              </Text>
            </View>
            {params.notes ? (
              <View style={styles.packageRow}>
                <Text variant="callout" color={colors.text.secondary}>
                  Catatan:
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
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Metode Pembayaran
          </Text>
          <ChipGroup<PaymentMethod>
            items={[
              { value: 'cash', label: 'Tunai ke Driver' },
              { value: 'qris', label: 'QRIS' },
              { value: 'ewallet', label: 'E-Wallet' },
              { value: 'bank_va', label: 'Virtual Account' },
            ]}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </View>

        {/* Rincian Biaya */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Rincian Pembayaran
          </Text>
          <Card variant="elevated" padding="lg">
            <PriceRow fee={fee} serviceFee={serviceFee} total={total} />
          </Card>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.bottomBar}>
        <Button
          label={tripId ? 'Kirim Permintaan ke Driver' : 'Posting Permintaan Terbuka'}
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

