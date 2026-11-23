import React from 'react';
import { Animated, View, StyleSheet, Pressable, ViewStyle, StyleProp } from 'react-native';
import { usePressScale } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
import { colors, radii, shadows, spacing } from '../theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
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
  const { scale, handlers } = usePressScale(0.985);
  const [pressed, setPressed] = React.useState(false);
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
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          setPressed(true);
          handlers.onPressIn?.();
        }}
        onPressOut={() => {
          setPressed(false);
          handlers.onPressOut?.();
        }}
        style={[containerStyle, pressed && { opacity: 0.94 }, style, { transform: [{ scale }] }]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
}
