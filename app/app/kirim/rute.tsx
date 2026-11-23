import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Phone, ArrowUpDown, Crosshair, ChevronRight } from '../../src/ui/icons';
import type { Place, HandoverMethod, PackageSize } from '@kirimin/shared';
import { HANDOVER_METHODS, HANDOVER_LABELS } from '@kirimin/shared';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  StepHeader,
  TextField,
  ChipGroup,
  Button,
  MapView,
  PlacePickerSheet,
} from '../../src/ui';
import { api } from '../../src/api/client';
import { formatRupiah, formatDistance } from '../../src/utils/format';
import { PLACE_BY_ID, findPlaceByPreset } from '../../src/constants/places';
import { KIRIM_STEPS } from '../../src/features/kirim/draft';

/** Step 1 of sending: where from, where to, and who receives it. */
export default function KirimRuteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { height: screenH } = useWindowDimensions();

  const parsePlaceParam = (raw: unknown): Place | undefined => {
    if (typeof raw !== 'string' || !raw.trim()) return undefined;
    try {
      const p = JSON.parse(raw);
      if (p && typeof p.lat === 'number' && typeof p.lng === 'number' && p.label) return p;
    } catch {
      // ignore
    }
    return undefined;
  };

  const initialPickup =
    parsePlaceParam(params.pickupJson) ||
    findPlaceByPreset(params.pickupPreset as string) ||
    PLACE_BY_ID.tukad_badung;
  const initialDropoff =
    parsePlaceParam(params.dropoffJson) ||
    findPlaceByPreset(params.dropoffPreset as string) ||
    PLACE_BY_ID.gedung_ft;

  const [pickup, setPickup] = useState<Place>(initialPickup);
  const [dropoff, setDropoff] = useState<Place>(initialDropoff);
  // A tap on the map moves this pin; most people set the destination, so start there.
  const [mapSelectionMode, setMapSelectionMode] = useState<'pickup' | 'dropoff'>('dropoff');
  const [pageScroll, setPageScroll] = useState(true);
  const [pickerTarget, setPickerTarget] = useState<'pickup' | 'dropoff' | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [handoverMethod, setHandoverMethod] = useState<HandoverMethod>('meet');
  const [estimate, setEstimate] = useState<{ distanceKm: number; range: { min: number; max: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The map is the point of this step: give it close to half the screen.
  const mapHeight = Math.round(Math.max(280, Math.min(460, screenH * 0.46)));

  useEffect(() => {
    let active = true;
    api
      .post<any>('/matches/estimate', {
        size: (params.sizePreset as PackageSize) || 'XS',
        pickup: { lat: pickup.lat, lng: pickup.lng },
        dropoff: { lat: dropoff.lat, lng: dropoff.lng },
      })
      .then((res) => active && setEstimate(res))
      .catch((err) => console.warn('Failed to estimate price:', err));
    return () => {
      active = false;
    };
  }, [pickup, dropoff, params.sizePreset]);

  const handleNext = () => {
    if (!recipientName.trim()) {
      setError('Tulis nama penerima');
      return;
    }
    if (!recipientPhone.trim() || recipientPhone.trim().length < 9) {
      setError('Nomor HP penerima minimal 9 digit');
      return;
    }
    router.push({
      pathname: '/kirim/paket',
      params: {
        ...params,
        pickup: JSON.stringify(pickup),
        dropoff: JSON.stringify(dropoff),
        recipient: JSON.stringify({ name: recipientName.trim(), phone: recipientPhone.trim() }),
        handoverMethod,
      },
    });
  };

  const renderPoint = (target: 'pickup' | 'dropoff', place: Place) => {
    const isPickup = target === 'pickup';
    const picking = mapSelectionMode === target;
    return (
      <View style={styles.pointRow}>
        <View style={[styles.pointDot, { backgroundColor: isPickup ? colors.primary : colors.senja }]} />
        <Pressable style={styles.pointText} onPress={() => setPickerTarget(target)} testID={`route-${target}`}>
          <Text variant="caption" color={colors.text.secondary}>
            {isPickup ? 'Jemput di' : 'Antar ke'}
          </Text>
          <Text variant="headline" numberOfLines={1}>
            {place.label}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMapSelectionMode(target)}
          style={[styles.mapPickBtn, picking && styles.mapPickBtnActive]}
          hitSlop={4}
          accessibilityLabel={isPickup ? 'Ketuk peta untuk titik jemput' : 'Ketuk peta untuk titik antar'}
        >
          <Crosshair size={18} color={picking ? '#FFFFFF' : colors.primary} />
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Kirim paket" />
      <StepHeader steps={KIRIM_STEPS} currentStep={1} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={pageScroll}>
        <MapView
          pickup={pickup}
          dropoff={dropoff}
          height={mapHeight}
          showSettings
          style={styles.map}
          selectionMode={mapSelectionMode}
          onSelectionModeChange={setMapSelectionMode}
          onInteractionChange={(active) => setPageScroll(!active)}
          overlayBottomInset={40}
          onSelectLocation={(place, target) => {
            if (target === 'pickup') setPickup(place);
            else setDropoff(place);
          }}
        />

        {/* Route card overlaps the bottom edge of the map. */}
        <View style={styles.routeCard}>
          {renderPoint('pickup', pickup)}
          <View style={styles.routeDivider}>
            <View style={styles.routeLine} />
            <Pressable
              onPress={() => {
                setPickup(dropoff);
                setDropoff(pickup);
              }}
              style={styles.swapBtn}
              hitSlop={6}
              accessibilityLabel="Tukar jemput dan antar"
            >
              <ArrowUpDown size={16} color={colors.text.secondary} />
            </Pressable>
          </View>
          {renderPoint('dropoff', dropoff)}

          {estimate ? (
            <View style={styles.estimate}>
              <Text variant="callout" color={colors.text.secondary}>
                {formatDistance(estimate.distanceKm)}
              </Text>
              <Text variant="calloutSemibold" color={colors.laut}>
                Kira-kira {formatRupiah(estimate.range.min)}–{formatRupiah(estimate.range.max)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text variant="title" style={styles.sectionTitle}>
            Siapa penerimanya?
          </Text>
          <TextField
            label="Nama"
            placeholder="Contoh: Dewa"
            value={recipientName}
            onChangeText={(t) => {
              setRecipientName(t);
              setError(null);
            }}
            leftElement={<User size={18} color={colors.text.muted} />}
          />
          <TextField
            label="Nomor HP"
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
          <Text variant="calloutSemibold" style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
            Cara serah terima
          </Text>
          <ChipGroup<HandoverMethod>
            items={HANDOVER_METHODS.map((m) => ({ value: m, label: HANDOVER_LABELS[m] }))}
            value={handoverMethod}
            onChange={setHandoverMethod}
          />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Lanjut ke detail paket"
          size="lg"
          onPress={handleNext}
          rightIcon={<ChevronRight size={18} color="#FFFFFF" />}
          testID="rute-next"
        />
      </View>

      <PlacePickerSheet
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        title={pickerTarget === 'pickup' ? 'Jemput di mana?' : 'Antar ke mana?'}
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
    paddingBottom: 120,
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
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickBtnActive: {
    backgroundColor: colors.primary,
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
  estimate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
