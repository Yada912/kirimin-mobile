import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Navigation, Clock, Crosshair, ArrowUpDown } from '../../src/ui/icons';
import type { Place, PackageSize } from '@kirimin/shared';
import { PACKAGE_SIZES, PACKAGE_SIZE_INFO } from '@kirimin/shared';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
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

  const { height: screenH } = useWindowDimensions();
  const mapHeight = Math.round(Math.max(260, Math.min(420, screenH * 0.42)));
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
      <TopBar title="Pasang rute" />

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {error}
            </Text>
          </Card>
        )}

        <MapView
          pickup={origin}
          dropoff={destination}
          stops={selectedStops}
          height={mapHeight}
          showSettings
          style={styles.map}
          selectionMode={mapSelectionMode}
          onSelectLocation={(place, target) => {
            if (target === 'pickup') setOrigin(place);
            else setDestination(place);
          }}
        />

        {/* Start and end of the route, overlapping the map. */}
        <View style={styles.routeCard}>
          {(['pickup', 'dropoff'] as const).map((target, i) => {
            const isStart = target === 'pickup';
            const place = isStart ? origin : destination;
            const picking = mapSelectionMode === target;
            return (
              <React.Fragment key={target}>
                {i === 1 ? (
                  <View style={styles.routeDivider}>
                    <View style={styles.routeLine} />
                    <Pressable onPress={handleSwap} style={styles.swapBtn} hitSlop={6} accessibilityLabel="Tukar asal dan tujuan">
                      <ArrowUpDown size={16} color={colors.text.secondary} />
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.pointRow}>
                  <View style={[styles.pointDot, { backgroundColor: isStart ? colors.sawah : colors.senja }]} />
                  <Pressable style={styles.pointText} onPress={() => setPickerTarget(isStart ? 'origin' : 'destination')}>
                    <Text variant="caption" color={colors.text.secondary}>
                      {isStart ? 'Berangkat dari' : 'Menuju'}
                    </Text>
                    <Text variant="headline" numberOfLines={1}>
                      {place.label}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMapSelectionMode((m) => (m === target ? null : target))}
                    style={[styles.mapPickBtn, picking && styles.mapPickBtnActive]}
                    hitSlop={4}
                    accessibilityLabel={isStart ? 'Pilih titik berangkat di peta' : 'Pilih tujuan di peta'}
                  >
                    <Crosshair size={18} color={picking ? '#FFFFFF' : colors.sawah} />
                  </Pressable>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        <View style={styles.body}>
        <View style={styles.section}>
          <TextField
            label="Nama rute"
            placeholder="Contoh: Ke kampus pagi"
            value={name}
            onChangeText={setName}
            leftElement={<Navigation size={18} color={colors.sawah} />}
          />
        </View>

        {/* Titik Singgah (Opsional) */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Lewat mana saja?
          </Text>
          <Text variant="caption" color={colors.text.secondary} style={{ marginBottom: spacing.sm }}>
            Opsional. Makin lengkap, makin banyak paket yang cocok.
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
            label="Jam berangkat"
            placeholder="08:00"
            value={departTime}
            onChangeText={setDepartTime}
            leftElement={<Clock size={18} color={colors.text.muted} />}
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
            label="Muat berapa paket?"
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
            label="Mau belok paling jauh"
            value={maxDetourKm}
            onChange={setMaxDetourKm}
            min={1}
            max={10}
            unit="km"
          />
        </View>

        {/* Ukuran Paket yang Diterima */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Ukuran yang bisa dibawa
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
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Pasang rute"
          style={{ backgroundColor: colors.sawah }}
          variant="primary"
          size="lg"
          loading={isPending}
          onPress={handleSubmit}
        />
      </View>

      <PlacePickerSheet
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        title={pickerTarget === 'origin' ? 'Berangkat dari mana?' : 'Menuju ke mana?'}
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
    paddingBottom: 110,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  map: {
    borderRadius: 0,
    borderWidth: 0,
  },
  routeCard: {
    marginHorizontal: spacing.lg,
    marginTop: -36,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.float,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  pointDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...shadows.card,
  },
  pointText: {
    flex: 1,
    marginLeft: spacing.md,
    paddingVertical: 4,
  },
  mapPickBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.sawahLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickBtnActive: {
    backgroundColor: colors.sawah,
  },
  routeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  routeLine: {
    width: 2,
    height: 20,
    marginLeft: 6,
    backgroundColor: colors.border,
  },
  swapBtn: {
    position: 'absolute',
    right: 48,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    margin: spacing.lg,
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
