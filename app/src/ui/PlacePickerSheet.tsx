import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import {
  MapPin,
  Navigation,
  Search,
  Check,
  Bookmark,
  Plus,
  Home,
  Briefcase,
  GraduationCap,
} from 'lucide-react-native';
import type { Place, SavedPlace, SavedPlaceKind } from '@kirimin/shared';
import { SAVED_PLACE_LABELS } from '@kirimin/shared';
import { BALI_PLACES, BaliPlace, describeCoordinates } from '../constants/places';
import { colors, radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';
import { TextField } from './TextField';
import { useSavedPlaces, useCreateSavedPlace } from '../api/hooks/useApi';

export interface PlacePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  selected?: Place | null;
  onSelect: (place: Place) => void;
}

const AREAS = ['Semua', 'Tersimpan', 'Denpasar', 'Badung', 'Bukit'] as const;

function SavedPlaceIcon({ kind, active }: { kind: SavedPlaceKind; active: boolean }) {
  const color = active ? '#FFFFFF' : colors.accent.violet;
  switch (kind) {
    case 'home':
      return <Home size={15} color={color} />;
    case 'work':
      return <Briefcase size={15} color={color} />;
    case 'campus':
      return <GraduationCap size={15} color={color} />;
    default:
      return <Bookmark size={15} color={color} />;
  }
}

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

  // Quick-add custom location inline right inside the picker
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [customKind, setCustomKind] = useState<SavedPlaceKind>('other');

  const { data: savedPlaces = [] } = useSavedPlaces();
  const { mutateAsync: createSavedPlace, isPending: creatingPlace } = useCreateSavedPlace();

  const filteredSaved = useMemo(() => {
    if (area !== 'Semua' && area !== 'Tersimpan') return [];
    const q = query.trim().toLowerCase();
    return savedPlaces.filter((p) => {
      if (!q) return true;
      return (
        p.label.toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q) ||
        SAVED_PLACE_LABELS[p.kind].toLowerCase().includes(q)
      );
    });
  }, [savedPlaces, query, area]);

  const filteredBali = useMemo(() => {
    if (area === 'Tersimpan') return [];
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
      const inBali =
        latitude >= -8.9 && latitude <= -8.0 && longitude >= 114.4 && longitude <= 115.8;
      const lat = inBali ? latitude : -8.6795;
      const lng = inBali ? longitude : 115.2275;
      const label = inBali
        ? describeCoordinates(lat, lng)
        : 'Lokasi Terdeteksi (Renon, Denpasar)';

      onSelect({ label, lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
      onClose();
    } catch {
      setLocError('Gagal membaca GPS perangkat. Gunakan daftar lokasi di bawah.');
    } finally {
      setLocating(false);
    }
  };

  const handlePickBali = (p: BaliPlace) => {
    onSelect({ label: p.label, address: p.address, lat: p.lat, lng: p.lng });
    onClose();
  };

  const handlePickSaved = (p: SavedPlace) => {
    onSelect({ label: p.label, address: p.address, lat: p.lat, lng: p.lng });
    onClose();
  };

  const handleQuickSave = async () => {
    if (!customLabel.trim()) return;
    try {
      const baseLat = selected?.lat ?? -8.705;
      const baseLng = selected?.lng ?? 115.215;
      const saved = await createSavedPlace({
        kind: customKind,
        label: customLabel.trim(),
        address: customAddress.trim() || undefined,
        lat: Number(baseLat.toFixed(5)),
        lng: Number(baseLng.toFixed(5)),
      });
      setCustomLabel('');
      setCustomAddress('');
      setShowQuickAdd(false);
      onSelect({ label: saved.label, address: saved.address, lat: saved.lat, lng: saved.lng });
      onClose();
    } catch {
      setLocError('Gagal menyimpan lokasi kustom.');
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <TextField
        placeholder="Cari alamat tersimpan, jalan, atau kampus..."
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
                {a === 'Tersimpan' ? `Tersimpan (${savedPlaces.length})` : a}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Quick Actions Row: GPS + Quick Save Custom Location */}
      <View style={styles.quickActionRow}>
        <Pressable onPress={handleUseCurrentGps} style={[styles.gpsBtn, { flex: 1 }]} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Navigation size={16} color={colors.primary} />
          )}
          <Text variant="captionMedium" color={colors.primary} weight="700" style={{ marginLeft: 6 }}>
            Lokasi GPS
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowQuickAdd((v) => !v)}
          style={[styles.addCustomBtn, showQuickAdd && styles.addCustomBtnActive]}
        >
          <Plus size={16} color={showQuickAdd ? '#FFFFFF' : colors.accent.violet} />
          <Text
            variant="captionMedium"
            color={showQuickAdd ? '#FFFFFF' : colors.accent.violet}
            weight="700"
            style={{ marginLeft: 4 }}
          >
            Lokasi Baru
          </Text>
        </Pressable>
      </View>

      {/* Inline Quick Add Custom Location Form */}
      {showQuickAdd ? (
        <View style={styles.quickAddCard}>
          <Text variant="calloutSemibold" color={colors.text.primary} style={{ marginBottom: 6 }}>
            Simpan Lokasi Kustom Baru
          </Text>
          <View style={styles.kindRow}>
            {(['home', 'work', 'campus', 'other'] as SavedPlaceKind[]).map((k) => {
              const active = customKind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setCustomKind(k)}
                  style={[styles.kindChip, active && styles.kindChipActive]}
                >
                  <Text variant="caption" color={active ? '#FFFFFF' : colors.text.secondary} weight="600">
                    {SAVED_PLACE_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextField
            placeholder="Nama lokasi (misal: Kos Jimbaran, Kafe Renon)"
            value={customLabel}
            onChangeText={setCustomLabel}
            containerStyle={{ marginBottom: spacing.xs }}
          />
          <TextField
            placeholder="Patokan alamat (opsional)"
            value={customAddress}
            onChangeText={setCustomAddress}
            containerStyle={{ marginBottom: spacing.sm }}
          />
          <Pressable
            onPress={handleQuickSave}
            disabled={!customLabel.trim() || creatingPlace}
            style={[
              styles.saveCustomBtn,
              (!customLabel.trim() || creatingPlace) && { opacity: 0.5 },
            ]}
          >
            <Text variant="calloutSemibold" color="#FFFFFF">
              {creatingPlace ? 'Menyimpan...' : 'Simpan & Gunakan Lokasi'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {locError ? (
        <Text variant="caption" color={colors.semantic.warning} style={{ marginBottom: spacing.sm }}>
          {locError}
        </Text>
      ) : null}

      {/* Saved Places Section */}
      {filteredSaved.length > 0 ? (
        <View style={{ marginBottom: spacing.md }}>
          <Text variant="captionMedium" color={colors.accent.violet} weight="700" style={styles.groupTitle}>
            LOKASI TERSIMPAN SAYA
          </Text>
          <View style={styles.list}>
            {filteredSaved.map((p) => {
              const isSelected = selected?.label === p.label;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => handlePickSaved(p)}
                  style={[styles.item, styles.savedItem, isSelected && styles.itemSelected]}
                >
                  <View style={[styles.iconWrap, styles.savedIconWrap, isSelected && styles.iconWrapSelected]}>
                    <SavedPlaceIcon kind={p.kind} active={isSelected} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text variant="calloutSemibold" color={colors.text.primary}>
                      {p.label}
                    </Text>
                    <Text variant="caption" color={colors.text.secondary}>
                      {SAVED_PLACE_LABELS[p.kind]}
                      {p.address ? ` • ${p.address}` : ''}
                    </Text>
                  </View>
                  {isSelected ? <Check size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Bali Corridor Places */}
      {filteredBali.length > 0 ? (
        <View>
          <Text variant="captionMedium" color={colors.text.muted} weight="700" style={styles.groupTitle}>
            TITIK POPULER KORIDOR BALI
          </Text>
          <View style={styles.list}>
            {filteredBali.map((p) => {
              const isSelected = selected?.label === p.label;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => handlePickBali(p)}
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
            })}
          </View>
        </View>
      ) : null}

      {filteredSaved.length === 0 && filteredBali.length === 0 ? (
        <Text variant="callout" color={colors.text.muted} align="center" style={{ paddingVertical: 20 }}>
          Lokasi tidak ditemukan. Coba kata kunci lain, tambah lokasi baru, atau ketuk langsung di peta.
        </Text>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  areaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  areaPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
  },
  areaPillActive: {
    backgroundColor: colors.primaryLight,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accent.violetLight,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  addCustomBtnActive: {
    backgroundColor: colors.accent.violet,
    borderColor: colors.accent.violet,
  },
  quickAddCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  kindChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kindChipActive: {
    backgroundColor: colors.accent.violet,
    borderColor: colors.accent.violet,
  },
  saveCustomBtn: {
    backgroundColor: colors.accent.violet,
    paddingVertical: 11,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
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
  savedItem: {
    borderColor: '#EDE9FE',
    backgroundColor: '#FAF5FF',
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
  savedIconWrap: {
    backgroundColor: colors.accent.violetLight,
  },
  iconWrapSelected: {
    backgroundColor: colors.primary,
  },
});
