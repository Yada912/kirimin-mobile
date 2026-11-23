import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';

export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BrandLogoTone = 'brand' | 'kirim' | 'angkut' | 'light' | 'dark' | 'sunset';
export type BrandLogoSurface = 'plain' | 'tile' | 'soft';

export interface BrandLogoProps {
  size?: BrandLogoSize;
  /** Semantic color palette that adapts to Kirim (cobalt), Angkut (emerald), Brand (dual), etc. */
  tone?: BrandLogoTone;
  /** Container treatment: bare wordmark, solid colored badge tile, or soft tinted pill. */
  surface?: BrandLogoSurface;
  /** Backwards-compatible shorthand for surface/tone */
  variant?: 'dark' | 'light' | 'tile';
  /** Direct color overrides for any custom usage */
  boldColor?: string;
  lightColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ViewBox is 222 x 64 (aspect ratio 3.46875)
const SIZE_METRICS: Record<
  BrandLogoSize,
  {
    height: number;
    padH: number;
    padV: number;
    radius: number;
  }
> = {
  xs: { height: 15, padH: 8, padV: 4, radius: 8 },
  sm: { height: 21, padH: 10, padV: 5, radius: 10 },
  md: { height: 26, padH: 13, padV: 7, radius: 12 },
  lg: { height: 34, padH: 16, padV: 9, radius: 14 },
  xl: { height: 42, padH: 20, padV: 11, radius: 16 },
};

interface TonePalette {
  plain: { bold: string; light: string };
  tile: { bg: string; bold: string; light: string };
  soft: { bg: string; border: string; bold: string; light: string };
}

const TONE_PALETTES: Record<BrandLogoTone, TonePalette> = {
  // Signature dual identity: Cobalt "KIRIM" + Emerald/Teal "IN"
  brand: {
    plain: { bold: colors.primary, light: colors.driver },
    tile: { bg: colors.primary, bold: '#FFFFFF', light: '#A7F3D0' },
    soft: { bg: colors.primarySubtle, border: '#BFDBFE', bold: colors.primaryDeep, light: colors.driver },
  },
  // Sender (Kirim) Cobalt palette
  kirim: {
    plain: { bold: colors.primaryDeep, light: '#3B82F6' },
    tile: { bg: colors.primary, bold: '#FFFFFF', light: '#BFDBFE' },
    soft: { bg: colors.primaryLight, border: '#BFDBFE', bold: colors.primaryDeep, light: colors.primary },
  },
  // Driver (Angkut) Emerald palette
  angkut: {
    plain: { bold: colors.driverDeep, light: '#10B981' },
    tile: { bg: colors.driver, bold: '#FFFFFF', light: '#A7F3D0' },
    soft: { bg: colors.driverSubtle, border: colors.driverLight, bold: colors.driverDeep, light: colors.driver },
  },
  // Crisp white for placing on vibrant colored hero banners
  light: {
    plain: { bold: '#FFFFFF', light: 'rgba(255, 255, 255, 0.78)' },
    tile: { bg: 'rgba(255, 255, 255, 0.18)', bold: '#FFFFFF', light: 'rgba(255, 255, 255, 0.82)' },
    soft: { bg: 'rgba(255, 255, 255, 0.14)', border: 'rgba(255, 255, 255, 0.28)', bold: '#FFFFFF', light: 'rgba(255, 255, 255, 0.8)' },
  },
  // Clean deep slate monochrome
  dark: {
    plain: { bold: colors.text.primary, light: colors.text.secondary },
    tile: { bg: colors.text.primary, bold: '#FFFFFF', light: '#CBD5E1' },
    soft: { bg: '#F1F5F9', border: colors.border, bold: colors.text.primary, light: colors.text.secondary },
  },
  // Warm Bali sunset amber/coral accent for promos & highlights
  sunset: {
    plain: { bold: '#EA580C', light: '#F59E0B' },
    tile: { bg: '#EA580C', bold: '#FFFFFF', light: '#FDE68A' },
    soft: { bg: '#FFF7ED', border: '#FED7AA', bold: '#C2410C', light: '#F59E0B' },
  },
};

/**
 * Adaptive geometric Uber-inspired KIRIMIN vector wordmark:
 * heavy bold "KIRIM" paired with sleek light "IN".
 * Automatically adapts to Kirim (cobalt), Angkut (emerald), dual Brand, or any custom colors.
 */
export function BrandLogo({
  size = 'md',
  tone,
  surface,
  variant,
  boldColor,
  lightColor,
  backgroundColor,
  borderColor,
  style,
  testID,
}: BrandLogoProps) {
  // Resolve legacy `variant` if explicit tone/surface were not supplied
  const resolvedTone: BrandLogoTone =
    tone ?? (variant === 'light' ? 'light' : variant === 'dark' ? 'dark' : 'brand');
  const resolvedSurface: BrandLogoSurface =
    surface ?? (variant === 'tile' ? 'tile' : 'plain');

  const m = SIZE_METRICS[size];
  const width = Math.round((m.height * 222) / 64);
  const palette = TONE_PALETTES[resolvedTone];

  let boldFill = palette.plain.bold;
  let lightFill = palette.plain.light;
  let containerBg: string | undefined;
  let containerBorder: string | undefined;

  if (resolvedSurface === 'tile') {
    boldFill = palette.tile.bold;
    lightFill = palette.tile.light;
    containerBg = palette.tile.bg;
  } else if (resolvedSurface === 'soft') {
    boldFill = palette.soft.bold;
    lightFill = palette.soft.light;
    containerBg = palette.soft.bg;
    containerBorder = palette.soft.border;
  }

  // Apply explicit custom color overrides when provided
  if (boldColor) boldFill = boldColor;
  if (lightColor) lightFill = lightColor;
  if (backgroundColor) containerBg = backgroundColor;
  if (borderColor) containerBorder = borderColor;

  const svg = (
    <Svg
      width={width}
      height={m.height}
      viewBox="0 0 222 64"
      accessibilityLabel="KIRIMIN"
    >
      {/* K (bold) */}
      <Rect x="6" y="10" width="8.6" height="44" rx="1.2" fill={boldFill} />
      <Polygon points="14.2,29.5 29.5,10 39.8,10 22.8,31.4 14.2,37.8" fill={boldFill} />
      <Polygon points="18.8,26.8 40.4,54 30.0,54 14.2,34.2" fill={boldFill} />

      {/* I (bold) */}
      <Rect x="46.5" y="10" width="8.6" height="44" rx="1.2" fill={boldFill} />

      {/* R (bold) */}
      <Path
        fillRule="evenodd"
        d="M 63.5 10 H 81.2 C 90.2 10 95.8 15.1 95.8 22.8 C 95.8 29.0 91.9 33.4 85.6 34.8 L 96.8 54 H 86.9 L 76.9 35.6 H 72.1 V 54 H 63.5 Z M 72.1 17.6 V 28.1 H 80.6 C 84.7 28.1 87.2 26.1 87.2 22.85 C 87.2 19.6 84.7 17.6 80.6 17.6 Z"
        fill={boldFill}
      />

      {/* I (bold) */}
      <Rect x="103.5" y="10" width="8.6" height="44" rx="1.2" fill={boldFill} />

      {/* M (bold) */}
      <Polygon
        points="120.5,54 120.5,10 130.0,10 142.5,35.2 155.0,10 164.5,10 164.5,54 156.1,54 156.1,24.6 145.6,45.6 139.4,45.6 128.9,24.6 128.9,54"
        fill={boldFill}
      />

      {/* I (light) */}
      <Rect x="174.5" y="10" width="3.2" height="44" rx="0.8" fill={lightFill} />

      {/* N (light) */}
      <Rect x="186.5" y="10" width="3.2" height="44" rx="0.8" fill={lightFill} />
      <Rect x="212.3" y="10" width="3.2" height="44" rx="0.8" fill={lightFill} />
      <Polygon points="186.5,10 190.0,10 215.5,54 212.0,54" fill={lightFill} />
    </Svg>
  );

  if (resolvedSurface !== 'plain' || containerBg) {
    return (
      <View
        testID={testID}
        accessibilityRole="image"
        accessibilityLabel="KIRIMIN"
        style={[
          styles.container,
          {
            backgroundColor: containerBg,
            paddingHorizontal: m.padH,
            paddingVertical: m.padV,
            borderRadius: m.radius,
            borderWidth: containerBorder ? 1 : 0,
            borderColor: containerBorder,
          },
          style,
        ]}
      >
        {svg}
      </View>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel="KIRIMIN"
      style={[styles.wrap, style]}
    >
      {svg}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  container: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
