/**
 * Kirimin Design Tokens
 *
 * All screens, UI components and layouts strictly use these tokens.
 * Gojek-like structure in blue, Apple HIG principles (8pt grid, generous whitespace, 44pt touch targets).
 */

export const colors = {
  // Brand & Primary (Kirim — Electric Cobalt)
  primary: '#1463F3',
  primaryPressed: '#0E4BC1',
  primaryLight: '#EBF2FE',
  primarySubtle: '#F0F6FF',
  primaryDeep: '#0B3B9E',

  // Driver Mode Brand (Angkut — Fresh Emerald / Teal)
  driver: '#059669',
  driverPressed: '#047857',
  driverDeep: '#064E3B',
  driverLight: '#D1FAE5',
  driverSubtle: '#ECFDF5',

  // Bali palette — the warm accents that sit next to the blue.
  // laut = deep ocean (hero banners), kunyit = turmeric (highlights),
  // senja = sunset coral (alerts/promos), sawah = rice-field green (earnings).
  laut: '#0A2A6B',
  lautSoft: '#123C8F',
  kunyit: '#FFC531',
  kunyitLight: '#FFF4D1',
  senja: '#FF7A59',
  senjaLight: '#FFE9E2',
  sawah: '#0E9F6E',
  sawahLight: '#DDF6EC',
  langit: '#D8E7FF',

  // Lively Accents (Gojek / Apple Maps inspired warmth)
  accent: {
    indigo: '#4F46E5',
    indigoLight: '#EEF2FF',
    violet: '#7C3AED',
    violetLight: '#F3E8FF',
    amber: '#F59E0B',
    amberLight: '#FEF3C7',
    coral: '#F97316',
    coralLight: '#FFEDD5',
    teal: '#0D9488',
    tealLight: '#CCFBF1',
    pink: '#EC4899',
    pinkLight: '#FCE7F3',
  },

  // Navigation HUD (Apple Maps / Google Maps Turn-by-Turn)
  nav: {
    hudBg: '#064E3B',
    hudBgDark: '#0F172A',
    hudAccent: '#34D399',
    routeBlue: '#2563EB',
    routeCasing: '#FFFFFF',
    routeTraveled: '#94A3B8',
  },

  // Canvas & Surfaces
  background: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  surfaceMuted: '#EDF2F7',

  // Borders & Dividers
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderFocus: '#1463F3',

  // Text Hierarchy
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
    inverse: '#FFFFFF',
    brand: '#1463F3',
  },

  // Semantic
  semantic: {
    success: '#16A34A',
    successLight: '#DCFCE7',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    danger: '#DC2626',
    dangerLight: '#FEE2E2',
    info: '#0284C7',
    infoLight: '#E0F2FE',
  },

  // Status mapping
  status: {
    open: '#D97706',
    openBg: '#FEF3C7',
    requested: '#0284C7',
    requestedBg: '#E0F2FE',
    declined: '#DC2626',
    declinedBg: '#FEE2E2',
    accepted: '#1463F3',
    acceptedBg: '#EBF2FE',
    picked_up: '#7C3AED',
    picked_upBg: '#F3E8FF',
    in_transit: '#2563EB',
    in_transitBg: '#EFF6FF',
    arrived: '#059669',
    arrivedBg: '#D1FAE5',
    delivered: '#16A34A',
    deliveredBg: '#DCFCE7',
    cancelled: '#64748B',
    cancelledBg: '#F1F5F9',
    expired: '#64748B',
    expiredBg: '#F1F5F9',
    published: '#1463F3',
    publishedBg: '#EBF2FE',
    ongoing: '#2563EB',
    ongoingBg: '#EFF6FF',
    completed: '#16A34A',
    completedBg: '#DCFCE7',
  },
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
  },
  largeTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  callout: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  calloutSemibold: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400' as const,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
} as const;

/** Plus Jakarta Sans — loaded in app/_layout.tsx. One family per weight (Android ignores fontWeight on custom fonts). */
export const fonts = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
} as const;

export function fontFor(weight?: string | number | null): string {
  const w = String(weight ?? '400');
  if (w === 'bold') return fonts['700'];
  if (w === 'normal') return fonts['400'];
  const n = Math.min(800, Math.max(400, Math.round(Number(w) / 100) * 100 || 400));
  return fonts[String(n) as keyof typeof fonts];
}

export const touchTarget = {
  minHeight: 44,
  minWidth: 44,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  float: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

