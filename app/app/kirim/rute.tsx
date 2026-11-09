import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Navigation, User, Phone, Clock, HandMetal } from 'lucide-react-native';
import type { Place, HandoverMethod, PackageSize } from '@kirimin/shared';
import { HANDOVER_METHODS, HANDOVER_LABELS } from '@kirimin/shared';
import { colors, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  StepHeader,
  Card,
  TextField,
  ChipGroup,
  Button,
  MapView,
} from '../../src/ui';
import { api } from '../../src/api/client';
import { formatRupiah, formatDistance } from '../../src/utils/format';

// Demo places
const PRESET_PLACES: Record<string, Place> = {
  renon: { label: 'Jl. Tukad Badung, Renon', lat: -8.6795, lng: 115.2275 },
  sesetan: { label: 'Sesetan, Denpasar', lat: -8.7005, lng: 115.219 },
  kampus_bukit: { label: 'Gedung FT Kampus Bukit', lat: -8.799, lng: 115.1735 },
  jimbaran: { label: 'Jimbaran, Kuta Selatan', lat: -8.7983, lng: 115.1716 },
};

export default function KirimRuteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Locations default to Renon -> Kampus Bukit (as in the definition of done!)
  const [pickup, setPickup] = useState<Place>(PRESET_PLACES.renon);
  const [dropoff, setDropoff] = useState<Place>(PRESET_PLACES.kampus_bukit);

  // Recipient info
  const [recipientName, setRecipientName] = useState('Dewa');
  const [recipientPhone, setRecipientPhone] = useState('081299990001');

  // Handover method
  const [handoverMethod, setHandoverMethod] = useState<HandoverMethod>('meet');

  // Estimate state
  const [estimate, setEstimate] = useState<{ distanceKm: number; range: { min: number; max: number } } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch estimate whenever locations or size change
  useEffect(() => {
    let active = true;
    async function fetchEstimate() {
      if (!pickup || !dropoff) return;
      try {
        setEstimating(true);
        const res = await api.post<any>('/matches/estimate', {
          size: (params.size as PackageSize) || 'XS',
          pickup: { lat: pickup.lat, lng: pickup.lng },
          dropoff: { lat: dropoff.lat, lng: dropoff.lng },
        });
        if (active) {
          setEstimate(res);
        }
      } catch (err: any) {
        console.warn('Failed to estimate price:', err);
      } finally {
        if (active) setEstimating(false);
      }
    }
    fetchEstimate();
    return () => {
      active = false;
    };
  }, [pickup, dropoff, params.size]);

  const handleNext = () => {
    if (!recipientName.trim()) {
      setError('Nama penerima wajib diisi');
      return;
    }
    if (!recipientPhone.trim()) {
      setError('Nomor HP penerima wajib diisi');
      return;
    }

    router.push({
      pathname: '/kirim/driver',
      params: {
        ...params,
        pickup: JSON.stringify(pickup),
        dropoff: JSON.stringify(dropoff),
        recipient: JSON.stringify({ name: recipientName, phone: recipientPhone }),
        handoverMethod,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Rute & Penerima (S2)" />
      <StepHeader
        steps={['Paket', 'Rute', 'Driver', 'Konfirmasi']}
        currentStep={2}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Map Preview */}
        <View style={styles.mapContainer}>
          <MapView pickup={pickup} dropoff={dropoff} height={180} />
        </View>

        {/* Titik Jemput & Antar Selector */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Lokasi Penjemputan
          </Text>
          <View style={styles.presetButtons}>
            <Button
              label="Jl. Tukad Badung (Renon)"
              variant={pickup.label.includes('Tukad Badung') ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setPickup(PRESET_PLACES.renon)}
            />
            <Button
              label="Sesetan"
              variant={pickup.label.includes('Sesetan') ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setPickup(PRESET_PLACES.sesetan)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Lokasi Pengantaran
          </Text>
          <View style={styles.presetButtons}>
            <Button
              label="Gedung FT Kampus Bukit"
              variant={dropoff.label.includes('Gedung FT') ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setDropoff(PRESET_PLACES.kampus_bukit)}
            />
            <Button
              label="Jimbaran"
              variant={dropoff.label.includes('Jimbaran') ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setDropoff(PRESET_PLACES.jimbaran)}
            />
          </View>
        </View>

        {/* Estimasi Jarak & Biaya */}
        {estimate && (
          <Card variant="flat" padding="md" style={styles.estimateCard}>
            <View style={styles.estimateRow}>
              <View>
                <Text variant="captionMedium" color={colors.text.secondary}>
                  Jarak Pengiriman
                </Text>
                <Text variant="headline" color={colors.text.primary} weight="700">
                  {formatDistance(estimate.distanceKm)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="captionMedium" color={colors.text.secondary}>
                  Perkiraan Ongkos
                </Text>
                <Text variant="headline" color={colors.primary} weight="700">
                  {formatRupiah(estimate.range.min)} - {formatRupiah(estimate.range.max)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Data Penerima */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Informasi Penerima
          </Text>
          <TextField
            label="Nama Penerima"
            placeholder="Contoh: Dewa"
            value={recipientName}
            onChangeText={(t) => {
              setRecipientName(t);
              setError(null);
            }}
            leftElement={<User size={18} color={colors.text.muted} />}
          />
          <TextField
            label="Nomor Handphone Penerima"
            placeholder="Contoh: 081234567890"
            value={recipientPhone}
            onChangeText={(t) => {
              setRecipientPhone(t);
              setError(null);
            }}
            keyboardType="phone-pad"
            leftElement={<Phone size={18} color={colors.text.muted} />}
            error={error || undefined}
          />
        </View>

        {/* Metode Serah Terima */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Metode Serah Terima di Tujuan
          </Text>
          <ChipGroup<HandoverMethod>
            items={HANDOVER_METHODS.map((m) => ({
              value: m,
              label: HANDOVER_LABELS[m],
            }))}
            value={handoverMethod}
            onChange={setHandoverMethod}
          />
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <Button
          label="Lanjut: Cari Driver Searah"
          variant="primary"
          size="lg"
          loading={estimating}
          onPress={handleNext}
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
    paddingBottom: 100,
  },
  mapContainer: {
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  presetButtons: {
    gap: spacing.xs,
  },
  estimateCard: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginBottom: spacing.xl,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

