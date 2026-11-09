import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Navigation, Clock, ShieldCheck } from 'lucide-react-native';
import type { Place, PackageSize } from '@kirimin/shared';
import { PACKAGE_SIZES, PACKAGE_SIZE_INFO } from '@kirimin/shared';
import { colors, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  TextField,
  Button,
  ChipGroup,
  NumericStepper,
  Card,
  MapView,
} from '../../src/ui';
import { useCreateTrip } from '../../src/api/hooks/useApi';

const PRESETS: Record<string, Place> = {
  renon: { label: 'Renon, Denpasar', lat: -8.6726, lng: 115.2335 },
  sesetan: { label: 'Sesetan, Denpasar', lat: -8.7005, lng: 115.219 },
  kampus_bukit: { label: 'Kampus Bukit Jimbaran', lat: -8.7983, lng: 115.1716 },
  kuta: { label: 'Kuta, Badung', lat: -8.723, lng: 115.169 },
};

export default function AngkutBuatRuteScreen() {
  const router = useRouter();
  const { mutateAsync: createTrip, isPending } = useCreateTrip();

  const [name, setName] = useState('Ke Kampus');
  const [origin, setOrigin] = useState<Place>(PRESETS.renon);
  const [destination, setDestination] = useState<Place>(PRESETS.kampus_bukit);
  const [departTime, setDepartTime] = useState('08:00');
  const [maxPackages, setMaxPackages] = useState(3);
  const [maxDetourKm, setMaxDetourKm] = useState(2);
  const [acceptedSizes, setAcceptedSizes] = useState<PackageSize[]>(['XS', 'S']);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      if (!name.trim()) {
        setError('Nama rute wajib diisi');
        return;
      }

      // Calculate departure ISO
      const now = new Date();
      const [hours, minutes] = departTime.split(':').map(Number);
      now.setHours(hours || 8, minutes || 0, 0, 0);
      if (now.getTime() < Date.now()) {
        now.setDate(now.getDate() + 1);
      }

      const newTrip = await createTrip({
        name: name.trim(),
        origin,
        stops: [PRESETS.sesetan],
        destination,
        departAt: now.toISOString(),
        maxPackages,
        maxDetourKm,
        acceptedSizes,
        repeatDays: [1, 2, 3, 4, 5],
        vehicle: { type: 'motor', plate: 'DK 1101 XL' },
      });

      router.replace({ pathname: '/angkut/permintaan/[tripId]', params: { tripId: newTrip.id } });
    } catch (err: any) {
      setError(err.message || 'Gagal mempublikasikan rute');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Publikasikan Rute (D1-D2)" />

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {error}
            </Text>
          </Card>
        )}

        {/* Map Preview */}
        <MapView pickup={origin} dropoff={destination} height={160} style={{ marginBottom: spacing.lg }} />

        {/* Nama Rute */}
        <View style={styles.section}>
          <TextField
            label="Nama Rute Perjalanan"
            placeholder="Contoh: Ke Kampus Pagi, Berangkat Kantor"
            value={name}
            onChangeText={setName}
            leftElement={<Navigation size={18} color={colors.primary} />}
          />
        </View>

        {/* Titik Awal & Akhir */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Titik Asal & Tujuan
          </Text>
          <View style={styles.presetRow}>
            <Button
              label={`Asal: ${origin.label}`}
              variant="outline"
              size="sm"
              onPress={() => setOrigin(origin.label.includes('Renon') ? PRESETS.sesetan : PRESETS.renon)}
            />
            <Button
              label={`Tujuan: ${destination.label}`}
              variant="outline"
              size="sm"
              onPress={() =>
                setDestination(
                  destination.label.includes('Bukit') ? PRESETS.kuta : PRESETS.kampus_bukit
                )
              }
            />
          </View>
        </View>

        {/* Jam Keberangkatan */}
        <View style={styles.section}>
          <TextField
            label="Jam Berangkat"
            placeholder="08:00"
            value={departTime}
            onChangeText={setDepartTime}
            leftElement={<Clock size={18} color={colors.text.muted} />}
            helper="Format 24 jam (misal 08:30)"
          />
        </View>

        {/* Kapasitas Paket */}
        <View style={styles.section}>
          <NumericStepper
            label="Kapasitas Paket Maksimal"
            value={maxPackages}
            onChange={setMaxPackages}
            min={1}
            max={8}
            unit="paket"
          />
        </View>

        {/* Simpangan Maksimal */}
        <View style={styles.section}>
          <NumericStepper
            label="Simpangan Maksimal dari Rute"
            value={maxDetourKm}
            onChange={setMaxDetourKm}
            min={1}
            max={10}
            unit="km"
          />
        </View>

        {/* Ukuran Paket yang Diterima */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Ukuran Paket yang Diterima
          </Text>
          <ChipGroup<PackageSize>
            items={PACKAGE_SIZES.map((sz) => ({
              value: sz,
              label: PACKAGE_SIZE_INFO[sz].label,
              sublabel: `(${PACKAGE_SIZE_INFO[sz].hint})`,
            }))}
            value={acceptedSizes}
            onChange={setAcceptedSizes}
            multiSelect
          />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Publikasikan Rute Sekarang"
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
  presetRow: {
    gap: spacing.xs,
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

