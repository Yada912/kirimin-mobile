import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Pencil,
  Trash2,
  Home,
  Briefcase,
  GraduationCap,
  Bookmark,
  Crosshair,
  Sparkles,
} from '../../src/ui/icons';
import type { SavedPlace, SavedPlaceKind } from '@kirimin/shared';
import { SAVED_PLACE_KINDS, SAVED_PLACE_LABELS } from '@kirimin/shared';
import { colors, radii, spacing, shadows } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Button,
  TextField,
  MapView,
  SkeletonCard,
  EmptyState,
} from '../../src/ui';
import {
  useSavedPlaces,
  useCreateSavedPlace,
  useUpdateSavedPlace,
  useDeleteSavedPlace,
} from '../../src/api/hooks/useApi';
import { describeCoordinates } from '../../src/constants/places';

function KindIcon({ kind, color }: { kind: SavedPlaceKind; color: string }) {
  switch (kind) {
    case 'home':
      return <Home size={16} color={color} />;
    case 'work':
      return <Briefcase size={16} color={color} />;
    case 'campus':
      return <GraduationCap size={16} color={color} />;
    default:
      return <Bookmark size={16} color={color} />;
  }
}

export default function KelolaLokasiScreen() {
  const { data: places = [], isLoading } = useSavedPlaces();
  const { mutateAsync: createPlace, isPending: isCreating } = useCreateSavedPlace();
  const { mutateAsync: updatePlace, isPending: isUpdating } = useUpdateSavedPlace();
  const { mutateAsync: deletePlace } = useDeleteSavedPlace();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<SavedPlaceKind>('home');
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState({ lat: -8.6795, lng: 115.2275 });
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setKind('home');
    setLabel('');
    setAddress('');
    setCoords({ lat: -8.6795, lng: 115.2275 });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (p: SavedPlace) => {
    setEditingId(p.id);
    setKind(p.kind);
    setLabel(p.label);
    setAddress(p.address || '');
    setCoords({ lat: p.lat, lng: p.lng });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      setError('Nama lokasi wajib diisi (misal: Kos Jimbaran, Kantor Renon)');
      return;
    }
    try {
      setError(null);
      if (editingId) {
        await updatePlace({
          id: editingId,
          kind,
          label: label.trim(),
          address: address.trim() || null,
          lat: coords.lat,
          lng: coords.lng,
        });
        setStatusMsg(`Lokasi "${label.trim()}" berhasil diperbarui!`);
      } else {
        await createPlace({
          kind,
          label: label.trim(),
          address: address.trim() || undefined,
          lat: coords.lat,
          lng: coords.lng,
        });
        setStatusMsg(`Lokasi "${label.trim()}" ditambahkan ke daftar favorit!`);
      }
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan lokasi');
    }
  };

  const handleDelete = async (p: SavedPlace) => {
    try {
      await deletePlace(p.id);
      setStatusMsg(`Lokasi "${p.label}" telah dihapus.`);
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus lokasi');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar
        title="Alamat tersimpan"
        subtitle="Tampil otomatis di semua pemilih alamat"
        rightAction={
          !showForm ? (
            <Button
              label="Tambah"
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
        {statusMsg ? (
          <Card variant="flat" padding="sm" style={styles.successBanner}>
            <Sparkles size={15} color={colors.accent.violet} />
            <Text variant="captionMedium" color={colors.accent.violet} weight="700" style={{ marginLeft: 6, flex: 1 }}>
              {statusMsg}
            </Text>
          </Card>
        ) : null}

        {showForm ? (
          <Card variant="elevated" padding="lg" style={styles.formCard}>
            <Text variant="title" color={colors.text.primary} weight="700" style={{ marginBottom: 4 }}>
              {editingId ? 'Edit Lokasi Tersimpan' : 'Tambah Lokasi Kustom'}
            </Text>
            <Text variant="caption" color={colors.text.secondary} style={{ marginBottom: spacing.md }}>
              Ketuk peta untuk menaruh pin di tempat yang pas.
            </Text>

            {error ? (
              <Card variant="flat" padding="sm" style={styles.errorCard}>
                <Text variant="captionMedium" color={colors.semantic.danger}>
                  {error}
                </Text>
              </Card>
            ) : null}

            <MapView
              pickup={{ label: label || 'Titik Baru', lat: coords.lat, lng: coords.lng }}
              height={195}
              showSettings
              selectionMode="pickup"
              onSelectLocation={(place) => {
                setCoords({ lat: place.lat, lng: place.lng });
                if (!address.trim()) {
                  setAddress(describeCoordinates(place.lat, place.lng));
                }
              }}
            />

            <View style={styles.coordHint}>
              <Crosshair size={13} color={colors.primary} />
              <Text variant="caption" color={colors.text.secondary} style={{ marginLeft: 5 }}>
                Pin terpilih: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
            </View>

            <Text variant="captionMedium" color={colors.text.secondary} style={{ marginTop: spacing.sm, marginBottom: 6 }}>
              Kategori Lokasi
            </Text>
            <View style={styles.kindRow}>
              {SAVED_PLACE_KINDS.map((k) => {
                const active = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    style={[styles.kindPill, active && styles.kindPillActive]}
                  >
                    <KindIcon kind={k} color={active ? '#FFFFFF' : colors.accent.violet} />
                    <Text
                      variant="captionMedium"
                      color={active ? '#FFFFFF' : colors.text.primary}
                      weight="600"
                      style={{ marginLeft: 5 }}
                    >
                      {SAVED_PLACE_LABELS[k]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextField
              label="Nama tempat"
              placeholder="Contoh: Kos Tukad Badung, Lab FT Unud"
              value={label}
              onChangeText={(t) => {
                setLabel(t);
                setError(null);
              }}
            />

            <TextField
              label="Patokan (opsional)"
              placeholder="Contoh: Gang 2 pagar hitam depan warung"
              value={address}
              onChangeText={setAddress}
            />

            <View style={styles.formActions}>
              <Button
                label="Batal"
                variant="secondary"
                size="md"
                onPress={() => setShowForm(false)}
                style={{ flex: 1 }}
              />
              <Button
                label={editingId ? 'Simpan Perubahan' : 'Simpan Lokasi'}
                variant="primary"
                size="md"
                loading={isCreating || isUpdating}
                onPress={handleSave}
                style={{ flex: 2 }}
              />
            </View>
          </Card>
        ) : (
          <>
            <View style={styles.heroBanner}>
              <View style={{ flex: 1 }}>
                <Text variant="headline" color="#FFFFFF" weight="700">
                  Alamat favoritmu
                </Text>
                <Text variant="caption" color="#EDE9FE" style={{ marginTop: 2 }}>
                  Simpan rumah, kos, kampus, atau kantor untuk pemilihan rute lebih cepat.
                </Text>
              </View>
              <Pressable onPress={openCreate} style={styles.heroAddBtn}>
                <Plus size={16} color={colors.accent.violet} />
                <Text variant="captionMedium" color={colors.accent.violet} weight="700" style={{ marginLeft: 3 }}>
                  Baru
                </Text>
              </Pressable>
            </View>

            {isLoading ? (
              <SkeletonCard />
            ) : places.length === 0 ? (
              <EmptyState
                title="Belum ada alamat tersimpan"
                description="Tambahkan rumah, kampus, atau titik langganan agar langsung muncul saat pilih lokasi jemput & antar."
                actionLabel="Tambah Lokasi Pertama"
                onAction={openCreate}
                icon={<Bookmark size={42} color={colors.accent.violet} />}
              />
            ) : (
              <View style={styles.list}>
                {places.map((p) => (
                  <Card key={p.id} variant="elevated" padding="md" style={styles.placeCard}>
                    <View style={styles.placeTop}>
                      <View style={styles.placeIcon}>
                        <KindIcon kind={p.kind} color={colors.accent.violet} />
                      </View>
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <View style={styles.labelRow}>
                          <Text variant="headline" color={colors.text.primary} weight="700">
                            {p.label}
                          </Text>
                          <View style={styles.kindBadge}>
                            <Text variant="caption" color={colors.accent.violet} weight="700" style={{ fontSize: 10 }}>
                              {SAVED_PLACE_LABELS[p.kind]}
                            </Text>
                          </View>
                        </View>
                        <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
                          {p.address || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.placeActions}>
                      <Text variant="caption" color={colors.text.muted}>
                        {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable onPress={() => openEdit(p)} style={styles.editBtn}>
                          <Pencil size={14} color={colors.primary} />
                          <Text variant="caption" color={colors.primary} weight="700" style={{ marginLeft: 4 }}>
                            Edit
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => handleDelete(p)} style={styles.deleteBtn}>
                          <Trash2 size={14} color={colors.semantic.danger} />
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
    backgroundColor: colors.accent.violetLight,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: spacing.md,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.violet,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  heroAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    marginLeft: spacing.sm,
  },
  formCard: {
    backgroundColor: colors.surface,
  },
  coordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.accent.violetLight,
  },
  kindPillActive: {
    backgroundColor: colors.accent.violet,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  placeCard: {
    backgroundColor: colors.surface,
  },
  placeTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accent.violetLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kindBadge: {
    backgroundColor: colors.accent.violetLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  placeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  deleteBtn: {
    backgroundColor: colors.semantic.dangerLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
