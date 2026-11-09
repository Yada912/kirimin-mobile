import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, touchTarget } from '../theme/tokens';

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: 'plain' | 'filled' | 'tinted';
  size?: number;
  style?: ViewStyle;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  size = 44,
  style,
}: IconButtonProps) {
  const getBackground = (pressed: boolean) => {
    switch (variant) {
      case 'filled':
        return pressed ? colors.border : colors.surface;
      case 'tinted':
        return pressed ? colors.border : colors.surfaceMuted;
      case 'plain':
        return pressed ? colors.surfaceMuted : 'transparent';
    }
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        {
          width: Math.max(size, touchTarget.minWidth),
          height: Math.max(size, touchTarget.minHeight),
          backgroundColor: getBackground(pressed),
          borderRadius: radii.full,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
