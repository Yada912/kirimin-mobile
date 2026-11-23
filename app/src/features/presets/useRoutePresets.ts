import { useMemo } from 'react';
import type { RoutePreset } from '@kirimin/shared';
import { PLACE_BY_ID } from '../../constants/places';
import { useUserSettings, useUpdateUserSettings } from '../../api/hooks/useApi';

export const PRESET_COLORS = [
  { id: '#1463F3', label: 'Biru Kirimin', bg: '#EBF2FE' },
  { id: '#059669', label: 'Hijau Bali', bg: '#D1FAE5' },
  { id: '#F97316', label: 'Oranye Sunset', bg: '#FFEDD5' },
  { id: '#7C3AED', label: 'Ungu Kreatif', bg: '#F3E8FF' },
  { id: '#0D9488', label: 'Teal Pesisir', bg: '#CCFBF1' },
  { id: '#EC4899', label: 'Pink Cerah', bg: '#FCE7F3' },
] as const;

export const DEFAULT_ROUTE_PRESETS: RoutePreset[] = [
  {
    id: 'preset-renon-bukit',
    name: 'Renon → Kampus Bukit',
    subtitle: 'Jalur komuter mahasiswa & pekerja',
    pickup: {
      label: PLACE_BY_ID.tukad_badung.label,
      address: PLACE_BY_ID.tukad_badung.address,
      lat: PLACE_BY_ID.tukad_badung.lat,
      lng: PLACE_BY_ID.tukad_badung.lng,
    },
    dropoff: {
      label: PLACE_BY_ID.gedung_ft.label,
      address: PLACE_BY_ID.gedung_ft.address,
      lat: PLACE_BY_ID.gedung_ft.lat,
      lng: PLACE_BY_ID.gedung_ft.lng,
    },
    defaultCategory: 'Dokumen',
    defaultSize: 'XS',
    color: '#1463F3',
  },
  {
    id: 'preset-sesetan-jimbaran',
    name: 'Sesetan → Jimbaran',
    subtitle: 'Banyak driver motor pagi & sore',
    pickup: {
      label: PLACE_BY_ID.sesetan.label,
      address: PLACE_BY_ID.sesetan.address,
      lat: PLACE_BY_ID.sesetan.lat,
      lng: PLACE_BY_ID.sesetan.lng,
    },
    dropoff: {
      label: PLACE_BY_ID.jimbaran.label,
      address: PLACE_BY_ID.jimbaran.address,
      lat: PLACE_BY_ID.jimbaran.lat,
      lng: PLACE_BY_ID.jimbaran.lng,
    },
    defaultCategory: 'Makanan',
    defaultSize: 'S',
    color: '#F97316',
  },
  {
    id: 'preset-sanur-nusadua',
    name: 'Sanur → Nusa Dua',
    subtitle: 'Lewat Bypass Ngurah Rai cepat',
    pickup: {
      label: PLACE_BY_ID.sanur.label,
      address: PLACE_BY_ID.sanur.address,
      lat: PLACE_BY_ID.sanur.lat,
      lng: PLACE_BY_ID.sanur.lng,
    },
    dropoff: {
      label: PLACE_BY_ID.nusa_dua.label,
      address: PLACE_BY_ID.nusa_dua.address,
      lat: PLACE_BY_ID.nusa_dua.lat,
      lng: PLACE_BY_ID.nusa_dua.lng,
    },
    defaultCategory: 'Elektronik',
    defaultSize: 'M',
    color: '#059669',
  },
];

export function getPresetBg(hex?: string): string {
  const found = PRESET_COLORS.find((c) => c.id === hex);
  return found?.bg || '#EBF2FE';
}

/**
 * Provides the user's customizable route presets (synced to backend /me/settings)
 * with instant CRUD mutations (add, edit, delete, reset).
 */
export function useRoutePresets() {
  const { data: settings, isLoading } = useUserSettings();
  const { mutateAsync: updateSettings, isPending: isSaving } = useUpdateUserSettings();

  const presets = useMemo<RoutePreset[]>(() => {
    if (settings?.routePresets && settings.routePresets.length > 0) {
      return settings.routePresets;
    }
    return DEFAULT_ROUTE_PRESETS;
  }, [settings?.routePresets]);

  const saveAll = async (next: RoutePreset[]) => {
    await updateSettings({ routePresets: next });
  };

  const addPreset = async (preset: Omit<RoutePreset, 'id'>) => {
    const created: RoutePreset = {
      ...preset,
      id: `preset-${Date.now()}`,
    };
    await saveAll([created, ...presets].slice(0, 12));
    return created;
  };

  const editPreset = async (id: string, patch: Partial<Omit<RoutePreset, 'id'>>) => {
    const next = presets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    await saveAll(next);
  };

  const deletePreset = async (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    await saveAll(next);
  };

  const resetDefaults = async () => {
    await saveAll(DEFAULT_ROUTE_PRESETS);
  };

  return {
    presets,
    isLoading,
    isSaving,
    addPreset,
    editPreset,
    deletePreset,
    resetDefaults,
  };
}
