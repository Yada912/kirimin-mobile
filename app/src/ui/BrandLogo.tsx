import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';

export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type BrandLogoVariant = 'dark' | 'light' | 'tile';

export interface BrandLogoProps {
  size?: BrandLogoSize;
  variant?: BrandLogoVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ViewBox is 222 x 64 (aspect ratio 3.46875)
const SIZE_METRICS: Record<
  BrandLogoSize,
  {
    height: number;
    tilePadH: number;
    tilePadV: number;
    tileRadius: number;
  }
> = {
  xs: { height: 15, tilePadH: 7, tilePadV: 4, tileRadius: 6 },
  sm: { height: 21, tilePadH: 9, tilePadV: 5, tileRadius: 8 },
  md: { height: 26, tilePadH: 12, tilePadV: 6, tileRadius: 10 },
  lg: { height: 34, tilePadH: 15, tilePadV: 8, tileRadius: 12 },
  xl: { height: 42, tilePadH: 18, tilePadV: 10, tileRadius: 14 },
};

/**
 * Custom geometric Uber-inspired KIRIMIN vector wordmark:
 * heavy bold "KIRIM" paired with sleek light "IN".
 * Uses exact vector geometry so weight contrast is identical across iOS, Android, and Web.
 */
export function BrandLogo({
  size = 'md',
  variant = 'dark',
  style,
  testID,
}: BrandLogoProps) {
  const m = SIZE_METRICS[size];
  const width = Math.round((m.height * 222) / 64);
  const isTile = variant === 'tile';

  const boldFill = variant === 'dark' ? '#09090B' : '#FFFFFF';
  const lightFill =
    variant === 'dark'
      ? '#27272A'
      : variant === 'tile'
        ? '#D4D4D8'
        : 'rgba(255,255,255,0.88)';

  const svg = (
    <Svg
      width={width}
      height={m.height}
      viewBox="0 0 222 64"
      accessibilityLabel="KIRIMIN"
    >
      {/* K (bold) */}
      <Rect x="6" y="10" width="8.6" height="44" fill={boldFill} />
      <Polygon points="14.2,29.5 29.5,10 39.8,10 22.8,31.4 14.2,37.8" fill={boldFill} />
      <Polygon points="18.8,26.8 40.4,54 30.0,54 14.2,34.2" fill={boldFill} />

      {/* I (bold) */}
      <Rect x="46.5" y="10" width="8.6" height="44" fill={boldFill} />

      {/* R (bold) */}
      <Path
        fillRule="evenodd"
        d="M 63.5 10 H 81.2 C 90.2 10 95.8 15.1 95.8 22.8 C 95.8 29.0 91.9 33.4 85.6 34.8 L 96.8 54 H 86.9 L 76.9 35.6 H 72.1 V 54 H 63.5 Z M 72.1 17.6 V 28.1 H 80.6 C 84.7 28.1 87.2 26.1 87.2 22.85 C 87.2 19.6 84.7 17.6 80.6 17.6 Z"
        fill={boldFill}
      />

      {/* I (bold) */}
      <Rect x="103.5" y="10" width="8.6" height="44" fill={boldFill} />

      {/* M (bold) */}
      <Polygon
        points="120.5,54 120.5,10 130.0,10 142.5,35.2 155.0,10 164.5,10 164.5,54 156.1,54 156.1,24.6 145.6,45.6 139.4,45.6 128.9,24.6 128.9,54"
        fill={boldFill}
      />

      {/* I (light) */}
      <Rect x="174.5" y="10" width="3.1" height="44" fill={lightFill} />

      {/* N (light) */}
      <Rect x="186.5" y="10" width="3.1" height="44" fill={lightFill} />
      <Rect x="212.4" y="10" width="3.1" height="44" fill={lightFill} />
      <Polygon points="186.5,10 189.9,10 215.5,54 212.1,54" fill={lightFill} />
    </Svg>
  );

  if (isTile) {
    return (
      <View
        testID={testID}
        accessibilityRole="image"
        accessibilityLabel="KIRIMIN"
        style={[
          styles.tile,
          {
            paddingHorizontal: m.tilePadH,
            paddingVertical: m.tilePadV,
            borderRadius: m.tileRadius,
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
  tile: {
    backgroundColor: '#09090B',
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
