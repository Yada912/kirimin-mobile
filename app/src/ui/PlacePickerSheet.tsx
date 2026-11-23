import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Navigation, Search, Check } from 'lucide-react-native';
import type { Place } from '@kirimin/shared';
import { BALI_PLACES, BaliPlace, describeCoordinates } from '../constants/places';
import { colors, radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';
import { TextField } from './TextField';

export interface PlacePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  selected?: Place | null;
  onSelect: (place: Place) => void;
}

const AREAS = ['Semua', 'Denpasar', 'Badung', 'Bukit'] as const;

export function PlacePickerSheet({
  visible,
  onClose,
  title,
  selected,
  onSelect,
}: PlacePickerSheetProps) {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState<(typeof AREAS)[number]>('Semua');
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BALI_PLACES.filter((p) => {
      if (area !== 'Semua' && p.area !== area) return false;
      if (!q) return true;
      return (
        p.label.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q)
      );
    });
  }, [query, area]);

  const handleUseCurrentGps = async () => {
    try {
      setLocating(true);
      setLocError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Izin lokasi ditolak. Pilih titik dari daftar atau ketuk peta.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      // Check if coordinates are outside Bali corridor (e.g. default Mountain View emulator GPS)
      const inBali =
        latitude >= -8.9 && latitude <= -8.0 && longitude >= 114.4 && longitude <= 115.8;
      const lat = inBali ? latitude : -8.6795;
      const lng = inBali ? longitude : 115.2275;
      const label = inBali
        ? describeCoordinates(lat, lng)
        : 'Lokasi Emulator (Renon, Denpasar)';

      onSelect({ label, lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
      onClose();
    } catch {
      setLocError('Gagal membaca GPS perangkat. Gunakan daftar lokasi di bawah.');
    } finally {
      setLocating(false);
    }
  };

  const handlePick = (p: BaliPlace) => {
    onSelect({ label: p.label, lat: p.lat, lng: p.lng });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <TextField
        placeholder="Cari jalan, kampus, atau area di Bali..."
        value={query}
        onChangeText={setQuery}
        leftElement={<Search size={18} color={colors.text.muted} />}
        containerStyle={{ marginBottom: spacing.sm }}
      />

      {/* Area filter pills */}
      <View style={styles.areaRow}>
        {AREAS.map((a) => {
          const active = area === a;
          return (
            <Pressable
              key={a}
              onPress={() => setArea(a)}
              style={[styles.areaPill, active && styles.areaPillActive]}
            >
              <Text
                variant="captionMedium"
                color={active ? colors.primary : colors.text.secondary}
                weight={active ? '700' : '500'}
              >
                {a}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Current GPS button */}
      <Pressable onPress={handleUseCurrentGps} style={styles.gpsBtn} disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Navigation size={18} color={colors.primary} />
        )}
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text variant="calloutSemibold" color={colors.primary}>
            Gunakan Lokasi GPS Saat Ini
          </Text>
          <Text variant="caption" color={colors.text.secondary}>
            Otomatis deteksi titik koordinat perangkat
          </Text>
        </View>
      </Pressable>

      {locError ? (
        <Text variant="caption" color={colors.semantic.warning} style={{ marginBottom: spacing.sm }}>
          {locError}
        </Text>
      ) : null}

      {/* Place list */}
      <View style={styles.list}>
        {filtered.length === 0 ? (
          <Text variant="callout" color={colors.text.muted} align="center" style={{ paddingVertical: 20 }}>
            Lokasi tidak ditemukan. Coba kata kunci lain atau ketuk langsung di peta.
          </Text>
        ) : (
          filtered.map((p) => {
            const isSelected = selected?.label === p.label;
            return (
              <Pressable
                key={p.id}
                onPress={() => handlePick(p)}
                style={[styles.item, isSelected && styles.itemSelected]}
              >
                <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
                  <MapPin size={16} color={isSelected ? '#FFF' : colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text variant="calloutSemibold" color={colors.text.primary}>
                    {p.label}
                  </Text>
                  <Text variant="caption" color={colors.text.secondary}>
                    {p.address} • {p.area}
                  </Text>
                </View>
                {isSelected ? <Check size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  areaRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  areaPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
  },
  areaPillActive: {
    backgroundColor: colors.primaryLight,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  itemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: colors.primary,
  },
});
