import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '../theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: keyof typeof spacing;
}

export function Card({
  children,
  onPress,
  style,
  variant = 'elevated',
  padding = 'lg',
}: CardProps) {
  const containerStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing[padding],
    ...(variant === 'elevated'
      ? { ...shadows.card, borderWidth: 1, borderColor: colors.borderLight }
      : variant === 'outlined'
      ? { borderWidth: 1, borderColor: colors.border }
      : { backgroundColor: colors.surfaceSecondary }),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          containerStyle,
          pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
}
