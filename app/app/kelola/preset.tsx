import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  RotateCcw,
  Check,
  Sparkles,
  ArrowRight,
  Crosshair,
} from '../../src/ui/icons';
import type { Category, PackageSize, Place, RoutePreset } from '@kirimin/shared';
import { CATEGORIES, PACKAGE_SIZES } from '@kirimin/shared';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Button,
  TextField,
  ChipGroup,
  MapView,
  PlacePickerSheet,
} from '../../src/ui';
import { PLACE_BY_ID } from '../../src/constants/places';
import {
  useRoutePresets,
  PRESET_COLORS,
  getPresetBg,
} from '../../src/features/presets/useRoutePresets';
import { useAuth } from '../../src/auth/AuthContext';

export default function KelolaPresetScreen() {
  const router = useRouter();
  const { activeRole } = useAuth();
  const { presets, isSaving, addPreset, editPreset, deletePreset, resetDefaults } = useRoutePresets();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [pickup, setPickup] = useState<Place>(PLACE_BY_ID.tukad_badung);
  const [dropoff, setDropoff] = useState<Place>(PLACE_BY_ID.gedung_ft);
  const [defaultCategory, setDefaultCategory] = useState<Category>('Dokumen');
  const [defaultSize, setDefaultSize] = useState<PackageSize>('XS');
  const [color, setColor] = useState<string>(PRESET_COLORS[0].id);

  const [pickerTarget, setPickerTarget] = useState<'pickup' | 'dropoff' | null>(null);
  const [mapSelect, setMapSelect] = useState<'pickup' | 'dropoff' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setSubtitle('');
    setPickup(PLACE_BY_ID.renon);
    setDropoff(PLACE_BY_ID.kampus_bukit);
    setDefaultCategory('Dokumen');
    setDefaultSize('XS');
    setColor(PRESET_COLORS[0].id);
    setMapSelect(null);
    setError(null);
    setShowEditor(true);
  };

  const openEdit = (preset: RoutePreset) => {
    setEditingId(preset.id);
    setName(preset.name);
    setSubtitle(preset.subtitle || '');
    setPickup(preset.pickup);
    setDropoff(preset.dropoff);
    setDefaultCategory(preset.defaultCategory || 'Dokumen');
    setDefaultSize(preset.defaultSize || 'XS');
    setColor(preset.color || PRESET_COLORS[0].id);
    setMapSelect(null);
    setError(null);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Nama preset wajib diisi (misal: Kos → Kampus Pagi)');
      return;
    }
    try {
      setError(null);
      const payload = {
        name: name.trim(),
        subtitle: subtitle.trim() || `${pickup.label} → ${dropoff.label}`,
        pickup,
        dropoff,
        defaultCategory,
        defaultSize,
        color,
      };
      if (editingId) {
        await editPreset(editingId, payload);
        setBannerMsg(`Preset "${payload.name}" diperbarui!`);
      } else {
        await addPreset(payload);
        setBannerMsg(`Preset baru "${payload.name}" ditambahkan!`);
      }
      setShowEditor(false);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan preset');
    }
  };

  const handleDelete = async (preset: RoutePreset) => {
    try {
      await deletePreset(preset.id);
      setBannerMsg(`Preset "${preset.name}" dihapus.`);
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus preset');
    }
  };

  const handleUsePreset = (preset: RoutePreset) => {
    if (activeRole === 'driver') {
      router.push({
        pathname: '/angkut/buat-rute',
        params: {
          namePreset: preset.name,
          originJson: JSON.stringify(preset.pickup),
          destinationJson: JSON.stringify(preset.dropoff),
        },
      });
    } else {
      router.push({
        pathname: '/kirim/rute',
        params: {
          pickupPreset: preset.pickup.label,
          dropoffPreset: preset.dropoff.label,
          pickupJson: JSON.stringify(preset.pickup),
          dropoffJson: JSON.stringify(preset.dropoff),
          categoryPreset: preset.defaultCategory || '',
          sizePreset: preset.defaultSize || '',
        },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar
        title="Rute favorit"
        subtitle="Rute favoritmu"
        rightAction={
          !showEditor ? (
            <Button
              label="Baru"
              variant="primary"
              size="sm"
              fullWidth={false}
              leftIcon={<Plus size={14} color="#FFF" />}
              onPress={openCreate}
            />
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {bannerMsg ? (
          <Card variant="flat" padding="sm" style={styles.successBanner}>
            <Sparkles size={15} color={colors.driver} />
            <Text variant="captionMedium" color={colors.driverDeep} weight="700" style={{ marginLeft: 6, flex: 1 }}>
              {bannerMsg}
            </Text>
          </Card>
        ) : null}

        {showEditor ? (
          <Card variant="elevated" padding="lg" style={styles.editorCard}>
            <Text variant="title" color={colors.text.primary} weight="700" style={{ marginBottom: 4 }}>
              {editingId ? 'Edit Preset Rute' : 'Buat Preset Rute Baru'}
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ marginBottom: spacing.md }}>
              Muncul di Beranda supaya kirim atau pasang rute cukup sekali ketuk.
            </Text>

            {error ? (
              <Card variant="flat" padding="sm" style={styles.errorCard}>
                <Text variant="captionMedium" color={colors.semantic.danger}>
                  {error}
                </Text>
              </Card>
            ) : null}

            {/* Interactive Road Map Preview */}
            <MapView
              pickup={pickup}
              dropoff={dropoff}
              height={170}
              showSettings
              selectionMode={mapSelect}
              onSelectLocation={(place, target) => {
                if (target === 'pickup') setPickup(place);
                else setDropoff(place);
              }}
            />

            <View style={styles.mapBtnRow}>
              <Pressable
                onPress={() => setMapSelect((m) => (m === 'pickup' ? null : 'pickup'))}
                style={[styles.mapChip, mapSelect === 'pickup' && styles.mapChipActive]}
              >
                <Crosshair size={12} color={mapSelect === 'pickup' ? '#FFF' : colors.primary} />
                <Text
                  variant="caption"
                  color={mapSelect === 'pickup' ? '#FFF' : colors.primary}
                  weight="700"
                  style={{ marginLeft: 4 }}
                >
                  {mapSelect === 'pickup' ? 'Selesai Jemput' : 'Pin Jemput di Peta'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMapSelect((m) => (m === 'dropoff' ? null : 'dropoff'))}
                style={[styles.mapChip, mapSelect === 'dropoff' && styles.mapChipActiveGreen]}
              >
                <Crosshair size={12} color={mapSelect === 'dropoff' ? '#FFF' : colors.driver} />
                <Text
                  variant="caption"
                  color={mapSelect === 'dropoff' ? '#FFF' : colors.driver}
                  weight="700"
                  style={{ marginLeft: 4 }}
                >
                  {mapSelect === 'dropoff' ? 'Selesai Antar' : 'Pin Antar di Peta'}
                </Text>
              </Pressable>
            </View>

            <TextField
              label="Nama rute"
              placeholder="Contoh: Kos Renon → Kampus Bukit"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setError(null);
              }}
              containerStyle={{ marginTop: spacing.md }}
            />

            <TextField
              label="Catatan (opsional)"
              placeholder="Contoh: Rute pagi sebelum jam 08.00"
              value={subtitle}
              onChangeText={setSubtitle}
            />

            {/* Pickup & Dropoff Pickers */}
            <View style={styles.pointRow}>
              <Pressable onPress={() => setPickerTarget('pickup')} style={styles.pointBox}>
                <Text variant="caption" color={colors.primary} weight="700">
                  Jemput / Asal
                </Text>
                <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                  {pickup.label}
                </Text>
              </Pressable>
              <Pressable onPress={() => setPickerTarget('dropoff')} style={styles.pointBox}>
                <Text variant="caption" color={colors.driver} weight="700">
                  Antar / Tujuan
                </Text>
                <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                  {dropoff.label}
                </Text>
              </Pressable>
            </View>

            {/* Default Category & Size */}
            <Text variant="captionMedium" color={colors.text.secondary} style={styles.fieldLabel}>
              Kategori Paket Default
            </Text>
            <ChipGroup<Category>
              items={CATEGORIES.map((c) => ({ value: c, label: c }))}
              value={defaultCategory}
              onChange={setDefaultCategory}
            />

            <Text variant="captionMedium" color={colors.text.secondary} style={styles.fieldLabel}>
              Ukuran Default
            </Text>
            <ChipGroup<PackageSize>
              items={PACKAGE_SIZES.map((s) => ({ value: s, label: s }))}
              value={defaultSize}
              onChange={setDefaultSize}
            />

            {/* Accent Color Picker */}
            <Text variant="captionMedium" color={colors.text.secondary} style={styles.fieldLabel}>
              Warna Kartu Preset
            </Text>
            <View style={styles.colorRow}>
              {PRESET_COLORS.map((c) => {
                const active = color === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setColor(c.id)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c.id },
                      active && styles.colorDotActive,
                    ]}
                  >
                    {active ? <Check size={14} color="#FFFFFF" /> : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.editorActions}>
              <Button
                label="Batal"
                variant="secondary"
                size="md"
                onPress={() => setShowEditor(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={editingId ? 'Simpan Perubahan' : 'Simpan Preset'}
                variant="primary"
                size="md"
                loading={isSaving}
                onPress={handleSave}
                style={{ flex: 2 }}
              />
            </View>
          </Card>
        ) : (
          <>
            {/* Colorful Intro Banner */}
            <View style={styles.introBanner}>
              <View style={{ flex: 1 }}>
                <Text variant="headline" color="#FFFFFF" weight="700">
                  Rute favoritmu
                </Text>
                <Text variant="caption" color="#FEF3C7" style={{ marginTop: 2 }}>
                  Rute yang sering kamu pakai, tinggal ketuk dari Beranda.
                </Text>
              </View>
              <Pressable onPress={openCreate} style={styles.introBtn}>
                <Plus size={16} color={colors.accent.coral} />
                <Text variant="captionMedium" color={colors.accent.coral} weight="700" style={{ marginLeft: 3 }}>
                  Tambah
                </Text>
              </Pressable>
            </View>

            <View style={styles.list}>
              {presets.map((preset) => {
                const accent = preset.color || colors.primary;
                return (
                  <Card
                    key={preset.id}
                    variant="elevated"
                    padding="md"
                    style={[styles.presetItemCard, { borderLeftColor: accent }]}
                  >
                    <View style={styles.presetItemTop}>
                      <View style={[styles.presetIconBox, { backgroundColor: getPresetBg(accent) }]}>
                        <MapPin size={16} color={accent} />
                      </View>
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text variant="headline" color={colors.text.primary} weight="700">
                          {preset.name}
                        </Text>
                        <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
                          {preset.pickup.label} → {preset.dropoff.label}
                        </Text>
                      </View>
                      {preset.defaultSize ? (
                        <View style={[styles.tagPill, { backgroundColor: getPresetBg(accent) }]}>
                          <Text variant="caption" color={accent} weight="700">
                            {preset.defaultCategory || 'Paket'} • {preset.defaultSize}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.presetItemActions}>
                      <Pressable
                        onPress={() => handleUsePreset(preset)}
                        style={[styles.useBtn, { backgroundColor: getPresetBg(accent) }]}
                      >
                        <Text variant="captionMedium" color={accent} weight="700">
                          Gunakan
                        </Text>
                        <ArrowRight size={13} color={accent} style={{ marginLeft: 3 }} />
                      </Pressable>

                      <View style={styles.iconActions}>
                        <Pressable
                          onPress={() => openEdit(preset)}
                          style={styles.iconBtn}
                          accessibilityLabel={`Edit ${preset.name}`}
                        >
                          <Pencil size={15} color={colors.primary} />
                          <Text variant="caption" color={colors.primary} weight="600" style={{ marginLeft: 4 }}>
                            Edit
                          </Text>
                        </Pressable>

                        {presets.length > 1 ? (
                          <Pressable
                            onPress={() => handleDelete(preset)}
                            style={[styles.iconBtn, { backgroundColor: colors.semantic.dangerLight }]}
                            accessibilityLabel={`Hapus ${preset.name}`}
                          >
                            <Trash2 size={15} color={colors.semantic.danger} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>

            <Button
              label="Kembalikan ke bawaan"
              variant="ghost"
              size="md"
              leftIcon={<RotateCcw size={15} color={colors.primary} />}
              loading={isSaving}
              onPress={async () => {
                await resetDefaults();
                setBannerMsg('Preset dikembalikan ke rute bawaan Bali.');
              }}
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}
      </ScrollView>

      <PlacePickerSheet
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        title={pickerTarget === 'pickup' ? 'Pilih Titik Jemput / Asal' : 'Pilih Titik Antar / Tujuan'}
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
    padding: spacing.md,
    paddingBottom: 40,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.driverSubtle,
    borderWidth: 1,
    borderColor: colors.driverLight,
    marginBottom: spacing.md,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  introBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.coral,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  introBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    marginLeft: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  presetItemCard: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
  },
  presetItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  presetItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  iconActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  editorCard: {
    backgroundColor: colors.surface,
  },
  mapBtnRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  mapChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  mapChipActive: {
    backgroundColor: colors.primary,
  },
  mapChipActiveGreen: {
    backgroundColor: colors.driver,
  },
  pointRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pointBox: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  fieldLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  editorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
