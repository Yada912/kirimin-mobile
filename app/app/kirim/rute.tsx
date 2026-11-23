import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, User, Phone, ArrowUpDown, Crosshair } from 'lucide-react-native';
import type { Place, HandoverMethod, PackageSize } from '@kirimin/shared';
import { HANDOVER_METHODS, HANDOVER_LABELS } from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  StepHeader,
  Card,
  TextField,
  ChipGroup,
  Button,
  MapView,
  PlacePickerSheet,
} from '../../src/ui';
import { api } from '../../src/api/client';
import { formatRupiah, formatDistance } from '../../src/utils/format';
import { PLACE_BY_ID, findPlaceByPreset } from '../../src/constants/places';

const PICKUP_QUICK = [
  PLACE_BY_ID.tukad_badung,
  PLACE_BY_ID.sesetan,
  PLACE_BY_ID.panjer,
  PLACE_BY_ID.sanur,
];

const DROPOFF_QUICK = [
  PLACE_BY_ID.gedung_ft,
  PLACE_BY_ID.jimbaran,
  PLACE_BY_ID.kampus_bukit,
  PLACE_BY_ID.nusa_dua,
];

export default function KirimRuteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const initialPickup =
    findPlaceByPreset(params.pickupPreset as string) || PLACE_BY_ID.tukad_badung;
  const initialDropoff =
    findPlaceByPreset(params.dropoffPreset as string) || PLACE_BY_ID.gedung_ft;

  const [pickup, setPickup] = useState<Place>(initialPickup);
  const [dropoff, setDropoff] = useState<Place>(initialDropoff);

  // Interactive map pin pointing mode ('pickup' | 'dropoff' | null)
  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'pickup' | 'dropoff' | null>(null);

  // Recipient info
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  // Handover method
  const [handoverMethod, setHandoverMethod] = useState<HandoverMethod>('meet');

  // Estimate state
  const [estimate, setEstimate] = useState<{
    distanceKm: number;
    range: { min: number; max: number };
  } | null>(null);
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

  const handleSwap = () => {
    setPickup(dropoff);
    setDropoff(pickup);
  };

  const handleNext = () => {
    if (!recipientName.trim()) {
      setError('Nama penerima wajib diisi');
      return;
    }
    if (!recipientPhone.trim() || recipientPhone.trim().length < 9) {
      setError('Masukkan nomor HP penerima yang valid (minimal 9 digit)');
      return;
    }

    router.push({
      pathname: '/kirim/driver',
      params: {
        ...params,
        pickup: JSON.stringify(pickup),
        dropoff: JSON.stringify(dropoff),
        recipient: JSON.stringify({
          name: recipientName.trim(),
          phone: recipientPhone.trim(),
        }),
        handoverMethod,
      },
    });
  };

  const pickupOptions = PICKUP_QUICK.some((p) => p.label === pickup.label)
    ? PICKUP_QUICK
    : [pickup, ...PICKUP_QUICK];

  const dropoffOptions = DROPOFF_QUICK.some((p) => p.label === dropoff.label)
    ? DROPOFF_QUICK
    : [dropoff, ...DROPOFF_QUICK];

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Rute & Penerima" />
      <StepHeader
        steps={['Paket', 'Rute', 'Driver', 'Konfirmasi']}
        currentStep={2}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Interactive Map Preview with Settings */}
        <View style={styles.mapContainer}>
          <MapView
            pickup={pickup}
            dropoff={dropoff}
            height={210}
            showSettings
            selectionMode={mapSelectionMode}
            onSelectLocation={(place, target) => {
              if (target === 'pickup') setPickup(place);
              else setDropoff(place);
            }}
          />

          {/* Point-on-Map Controls */}
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
                {mapSelectionMode === 'pickup' ? 'Selesai Jemput' : 'Tunjuk Jemput'}
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
                {mapSelectionMode === 'dropoff' ? 'Selesai Antar' : 'Tunjuk Antar'}
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

        {/* Titik Jemput */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWithDot}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text variant="headline" color={colors.text.primary} weight="700">
                Lokasi Penjemputan
              </Text>
            </View>
            <Pressable onPress={() => setPickerTarget('pickup')} hitSlop={8}>
              <Text variant="calloutSemibold" color={colors.primary}>
                Semua Lokasi
              </Text>
            </Pressable>
          </View>

          <ChipGroup<string>
            items={pickupOptions.map((p) => ({ value: p.label, label: p.label }))}
            value={pickup.label}
            onChange={(label) => {
              const found = pickupOptions.find((p) => p.label === label);
              if (found) setPickup({ label: found.label, lat: found.lat, lng: found.lng });
            }}
          />
          <Text variant="caption" color={colors.text.muted} style={{ marginTop: 6 }}>
            Koordinat: {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
          </Text>
        </View>

        {/* Titik Antar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWithDot}>
              <View style={[styles.dot, { backgroundColor: colors.semantic.success }]} />
              <Text variant="headline" color={colors.text.primary} weight="700">
                Lokasi Pengantaran
              </Text>
            </View>
            <Pressable onPress={() => setPickerTarget('dropoff')} hitSlop={8}>
              <Text variant="calloutSemibold" color={colors.primary}>
                Semua Lokasi
              </Text>
            </Pressable>
          </View>

          <ChipGroup<string>
            items={dropoffOptions.map((p) => ({ value: p.label, label: p.label }))}
            value={dropoff.label}
            onChange={(label) => {
              const found = dropoffOptions.find((p) => p.label === label);
              if (found) setDropoff({ label: found.label, lat: found.lat, lng: found.lng });
            }}
          />
          <Text variant="caption" color={colors.text.muted} style={{ marginTop: 6 }}>
            Koordinat: {dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)}
          </Text>
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
                  {formatRupiah(estimate.range.min)} – {formatRupiah(estimate.range.max)}
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

      {/* Full Bali Place Picker Sheet */}
      <PlacePickerSheet
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        title={
          pickerTarget === 'pickup'
            ? 'Pilih Lokasi Penjemputan'
            : 'Pilih Lokasi Pengantaran'
        }
        selected={pickerTarget === 'pickup' ? pickup : dropoff}
        onSelect={(place) => {
          if (pickerTarget === 'pickup') setPickup(place);
          else if (pickerTarget === 'dropoff') setDropoff(place);
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
    paddingBottom: 108,
  },
  mapContainer: {
    marginBottom: spacing.lg,
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
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
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
