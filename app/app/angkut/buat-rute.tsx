import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Navigation, Clock, Crosshair, ArrowUpDown } from 'lucide-react-native';
import type { Place, PackageSize } from '@kirimin/shared';
import { PACKAGE_SIZES, PACKAGE_SIZE_INFO } from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  TextField,
  Button,
  ChipGroup,
  NumericStepper,
  Card,
  MapView,
  PlacePickerSheet,
} from '../../src/ui';
import { useCreateTrip } from '../../src/api/hooks/useApi';
import { useAuth } from '../../src/auth/AuthContext';
import { BALI_PLACES, PLACE_BY_ID } from '../../src/constants/places';

const QUICK_TIMES = ['07:30', '08:00', '12:00', '17:00'];

function parsePlaceParam(raw: unknown): Place | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p.lat === 'number' && typeof p.lng === 'number' && p.label) return p;
  } catch {
    // ignore
  }
  return undefined;
}

export default function AngkutBuatRuteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { mutateAsync: createTrip, isPending } = useCreateTrip();

  const [name, setName] = useState((params.namePreset as string) || 'Ke Kampus');
  const [origin, setOrigin] = useState<Place>(
    parsePlaceParam(params.originJson) || PLACE_BY_ID.renon,
  );
  const [destination, setDestination] = useState<Place>(
    parsePlaceParam(params.destinationJson) || PLACE_BY_ID.kampus_bukit,
  );
  const [selectedStopLabels, setSelectedStopLabels] = useState<string[]>([
    PLACE_BY_ID.sesetan.label,
    PLACE_BY_ID.dewa_ruci.label,
  ]);
  const [departTime, setDepartTime] = useState('08:00');
  const [maxPackages, setMaxPackages] = useState(3);
  const [maxDetourKm, setMaxDetourKm] = useState(2);
  const [acceptedSizes, setAcceptedSizes] = useState<PackageSize[]>(['XS', 'S']);
  const [error, setError] = useState<string | null>(null);

  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'origin' | 'destination' | null>(null);

  const stopCandidates = useMemo(
    () =>
      BALI_PLACES.filter(
        (p) => p.label !== origin.label && p.label !== destination.label,
      ).slice(0, 6),
    [origin.label, destination.label],
  );

  const selectedStops: Place[] = useMemo(
    () =>
      stopCandidates
        .filter((p) => selectedStopLabels.includes(p.label))
        .map((p) => ({ label: p.label, lat: p.lat, lng: p.lng })),
    [stopCandidates, selectedStopLabels],
  );

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      if (!name.trim()) {
        setError('Nama rute wajib diisi');
        return;
      }
      if (acceptedSizes.length === 0) {
        setError('Pilih minimal satu ukuran paket yang diterima');
        return;
      }

      const [hoursRaw, minutesRaw] = departTime.split(':');
      const hours = Number(hoursRaw);
      const minutes = Number(minutesRaw);
      if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        setError('Format jam berangkat tidak valid (gunakan HH:MM, misal 08:00)');
        return;
      }

      const now = new Date();
      now.setHours(hours, minutes, 0, 0);
      if (now.getTime() < Date.now() + 60_000) {
        now.setDate(now.getDate() + 1);
      }

      const newTrip = await createTrip({
        name: name.trim(),
        origin,
        stops: selectedStops,
        destination,
        departAt: now.toISOString(),
        maxPackages,
        maxDetourKm,
        acceptedSizes,
        repeatDays: [1, 2, 3, 4, 5],
        vehicle: user?.vehicle || { type: 'motor', plate: 'DK 1101 XL' },
      });

      router.replace({ pathname: '/angkut/permintaan/[tripId]', params: { tripId: newTrip.id } });
    } catch (err: any) {
      setError(err.message || 'Gagal mempublikasikan rute');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Publikasikan Rute" />

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {error}
            </Text>
          </Card>
        )}

        {/* Interactive Map Preview with Stops & Settings */}
        <View style={{ marginBottom: spacing.lg }}>
          <MapView
            pickup={origin}
            dropoff={destination}
            stops={selectedStops}
            height={190}
            showSettings
            selectionMode={mapSelectionMode}
            onSelectLocation={(place, target) => {
              if (target === 'pickup') setOrigin(place);
              else setDestination(place);
            }}
          />

          <View style={styles.mapActionRow}>
            <Pressable
              onPress={() =>
                setMapSelectionMode((m) => (m === 'pickup' ? null : 'pickup'))
              }
              style={[
                styles.mapActionChip,
                mapSelectionMode === 'pickup' && styles.mapActionChipActive,
              ]}
            >
              <Crosshair
                size={13}
                color={mapSelectionMode === 'pickup' ? '#FFF' : colors.primary}
              />
              <Text
                variant="captionMedium"
                color={mapSelectionMode === 'pickup' ? '#FFF' : colors.primary}
                weight="600"
                style={{ marginLeft: 4 }}
              >
                {mapSelectionMode === 'pickup' ? 'Selesai Asal' : 'Tunjuk Asal'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setMapSelectionMode((m) => (m === 'dropoff' ? null : 'dropoff'))
              }
              style={[
                styles.mapActionChip,
                mapSelectionMode === 'dropoff' && styles.mapActionChipActiveGreen,
              ]}
            >
              <Crosshair
                size={13}
                color={
                  mapSelectionMode === 'dropoff' ? '#FFF' : colors.semantic.success
                }
              />
              <Text
                variant="captionMedium"
                color={
                  mapSelectionMode === 'dropoff' ? '#FFF' : colors.semantic.success
                }
                weight="600"
                style={{ marginLeft: 4 }}
              >
                {mapSelectionMode === 'dropoff' ? 'Selesai Tujuan' : 'Tunjuk Tujuan'}
              </Text>
            </Pressable>

            <Pressable onPress={handleSwap} style={styles.swapChip}>
              <ArrowUpDown size={13} color={colors.text.secondary} />
              <Text
                variant="captionMedium"
                color={colors.text.secondary}
                weight="600"
                style={{ marginLeft: 4 }}
              >
                Tukar
              </Text>
            </Pressable>
          </View>
        </View>

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
          <View style={styles.endpointRow}>
            <Pressable
              onPress={() => setPickerTarget('origin')}
              style={styles.endpointCard}
            >
              <View style={styles.endpointHeader}>
                <MapPin size={14} color={colors.primary} />
                <Text variant="captionMedium" color={colors.primary} weight="700" style={{ marginLeft: 4 }}>
                  Asal
                </Text>
              </View>
              <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                {origin.label}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPickerTarget('destination')}
              style={styles.endpointCard}
            >
              <View style={styles.endpointHeader}>
                <MapPin size={14} color={colors.semantic.success} />
                <Text variant="captionMedium" color={colors.semantic.success} weight="700" style={{ marginLeft: 4 }}>
                  Tujuan
                </Text>
              </View>
              <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                {destination.label}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Titik Singgah (Opsional) */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Lewat Titik Singgah (Opsional)
          </Text>
          <Text variant="caption" color={colors.text.secondary} style={{ marginBottom: spacing.xs }}>
            Membantu sistem mencocokkan lebih banyak paket di jalur Anda
          </Text>
          <ChipGroup<string>
            items={stopCandidates.map((p) => ({
              value: p.label,
              label: p.label.split(',')[0],
            }))}
            value={selectedStopLabels}
            onChange={setSelectedStopLabels}
            multiSelect
          />
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
          <View style={{ marginTop: spacing.xs }}>
            <ChipGroup<string>
              items={QUICK_TIMES.map((t) => ({ value: t, label: t }))}
              value={departTime}
              onChange={setDepartTime}
            />
          </View>
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

      <PlacePickerSheet
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        title={pickerTarget === 'origin' ? 'Pilih Titik Asal' : 'Pilih Titik Tujuan'}
        selected={pickerTarget === 'origin' ? origin : destination}
        onSelect={(place) => {
          if (pickerTarget === 'origin') setOrigin(place);
          else if (pickerTarget === 'destination') setDestination(place);
        }}
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
    paddingBottom: 110,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  mapActionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  mapActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  mapActionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mapActionChipActiveGreen: {
    backgroundColor: colors.semantic.success,
    borderColor: colors.semantic.success,
  },
  swapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
  },
  endpointRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  endpointCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  endpointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
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
