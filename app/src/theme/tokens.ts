/**
 * Kirimin Design Tokens
 *
 * All screens, UI components and layouts strictly use these tokens.
 * Gojek-like structure in blue, Apple HIG principles (8pt grid, generous whitespace, 44pt touch targets).
 */

export const colors = {
  // Brand & Primary
  primary: '#1463F3',
  primaryPressed: '#0E4BC1',
  primaryLight: '#EBF2FE',
  primarySubtle: '#F0F6FF',

  // Canvas & Surfaces
  background: '#F5F7FA',
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
  largeTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
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
    lineHeight: 16,
    fontWeight: '400' as const,
  },
  captionMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
} as const;

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

