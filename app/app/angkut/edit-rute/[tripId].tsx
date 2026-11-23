import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, Clock, Trash2 } from 'lucide-react-native';
import type { PackageSize, Place } from '@kirimin/shared';
import { PACKAGE_SIZES, PACKAGE_SIZE_INFO } from '@kirimin/shared';
import { colors, spacing } from '../../../src/theme/tokens';
import {
  Text,
  TopBar,
  TextField,
  Button,
  ChipGroup,
  NumericStepper,
  Card,
  MapView,
  SkeletonCard,
  ErrorState,
  Dialog,
} from '../../../src/ui';
import { useTrip, useUpdateTrip, useCancelTrip } from '../../../src/api/hooks/useApi';
import { BALI_PLACES } from '../../../src/constants/places';

const QUICK_TIMES = ['07:30', '08:00', '12:00', '17:00'];

export default function AngkutEditRuteScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const { data: trip, isLoading, isError, error, refetch } = useTrip(tripId);
  const { mutateAsync: updateTrip, isPending: saving } = useUpdateTrip();
  const { mutateAsync: cancelTrip, isPending: cancelling } = useCancelTrip();

  const [name, setName] = useState('');
  const [selectedStopLabels, setSelectedStopLabels] = useState<string[]>([]);
  const [departTime, setDepartTime] = useState('08:00');
  const [maxPackages, setMaxPackages] = useState(3);
  const [maxDetourKm, setMaxDetourKm] = useState(2);
  const [acceptedSizes, setAcceptedSizes] = useState<PackageSize[]>(['XS', 'S']);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    if (!trip) return;
    setName(trip.name);
    setSelectedStopLabels((trip.stops || []).map((s) => s.label));
    const d = new Date(trip.departAt);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setDepartTime(`${hh}:${mm}`);
    }
    setMaxPackages(trip.maxPackages);
    setMaxDetourKm(Math.max(1, Math.round(trip.maxDetourKm)));
    setAcceptedSizes(trip.acceptedSizes);
  }, [trip]);

  const stopCandidates = useMemo(() => {
    if (!trip) return BALI_PLACES.slice(0, 6);
    return BALI_PLACES.filter(
      (p) => p.label !== trip.origin.label && p.label !== trip.destination.label,
    ).slice(0, 6);
  }, [trip]);

  const selectedStops: Place[] = useMemo(
    () =>
      stopCandidates
        .filter((p) => selectedStopLabels.includes(p.label))
        .map((p) => ({ label: p.label, lat: p.lat, lng: p.lng })),
    [stopCandidates, selectedStopLabels],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Edit Rute" />
        <View style={styles.content}>
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !trip) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Edit Rute" />
        <ErrorState
          message={(error as any)?.message || 'Rute tidak ditemukan'}
          onRetry={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    try {
      setFormError(null);
      if (!name.trim()) {
        setFormError('Nama rute wajib diisi');
        return;
      }
      if (acceptedSizes.length === 0) {
        setFormError('Pilih minimal satu ukuran paket');
        return;
      }
      const [hRaw, mRaw] = departTime.split(':');
      const hh = Number(hRaw);
      const mm = Number(mRaw);
      if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        setFormError('Format jam tidak valid (HH:MM)');
        return;
      }

      const d = new Date(trip.departAt);
      d.setHours(hh, mm, 0, 0);
      if (d.getTime() < Date.now() + 60_000) {
        d.setDate(d.getDate() + 1);
      }

      await updateTrip({
        tripId: trip.id,
        name: name.trim(),
        stops: selectedStops,
        departAt: d.toISOString(),
        maxPackages: Math.max(trip.slotsUsed, maxPackages),
        maxDetourKm,
        acceptedSizes,
      });

      router.back();
    } catch (err: any) {
      setFormError(err.message || 'Gagal memperbarui rute');
    }
  };

  const handleCancelRoute = async () => {
    setShowCancelDialog(false);
    try {
      await cancelTrip({ tripId: trip.id, reason: 'Jadwal perjalanan berubah' });
      router.replace('/(angkut)/rute');
    } catch (err: any) {
      setFormError(err.message || 'Tidak dapat membatalkan rute ini');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Edit Rute Perjalanan" subtitle={`${trip.origin.label} → ${trip.destination.label}`} />

      <ScrollView contentContainerStyle={styles.content}>
        {formError ? (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {formError}
            </Text>
          </Card>
        ) : null}

        <View style={{ marginBottom: spacing.md }}>
          <MapView
            pickup={trip.origin}
            dropoff={trip.destination}
            stops={selectedStops}
            height={180}
            showSettings
          />
        </View>

        <View style={styles.section}>
          <TextField
            label="Nama Rute"
            value={name}
            onChangeText={setName}
            leftElement={<Navigation size={18} color={colors.driver} />}
          />
        </View>

        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Titik Singgah Rute
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

        <View style={styles.section}>
          <TextField
            label="Jam Berangkat"
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

        <View style={styles.section}>
          <NumericStepper
            label="Kapasitas Paket Maksimal"
            value={maxPackages}
            onChange={setMaxPackages}
            min={Math.max(1, trip.slotsUsed)}
            max={10}
            unit="paket"
          />
        </View>

        <View style={styles.section}>
          <NumericStepper
            label="Simpangan Maksimal"
            value={maxDetourKm}
            onChange={setMaxDetourKm}
            min={1}
            max={10}
            unit="km"
          />
        </View>

        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Ukuran Paket yang Diterima
          </Text>
          <ChipGroup<PackageSize>
            items={PACKAGE_SIZES.map((sz) => ({
              value: sz,
              label: PACKAGE_SIZE_INFO[sz].label,
            }))}
            value={acceptedSizes}
            onChange={setAcceptedSizes}
            multiSelect
          />
        </View>

        <Button
          label="Batalkan Rute Ini"
          variant="ghost"
          size="md"
          leftIcon={<Trash2 size={16} color={colors.semantic.danger} />}
          loading={cancelling}
          onPress={() => setShowCancelDialog(true)}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Simpan Perubahan Rute"
          variant="primary"
          size="lg"
          loading={saving}
          onPress={handleSave}
          style={{ backgroundColor: colors.driver }}
        />
      </View>

      <Dialog
        visible={showCancelDialog}
        title="Batalkan Rute?"
        message="Permintaan paket yang menunggu akan dibatalkan otomatis."
        confirmLabel="Ya, Batalkan"
        cancelLabel="Kembali"
        isDestructive
        onConfirm={handleCancelRoute}
        onCancel={() => setShowCancelDialog(false)}
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
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
