import React from 'react';
import {
  Animated,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, spacing, touchTarget, typography } from '../theme/tokens';
import { Text } from './Text';
import { usePressScale } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Overrides the label colour (e.g. a white button on a coloured banner). */
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  /** For E2E tests (Maestro `id:`). */
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  textColor,
  style,
  testID,
}: ButtonProps) {
  const isInteractive = !disabled && !loading;
  const [pressed, setPressed] = React.useState(false);
  const { scale, handlers } = usePressScale(0.97);

  // Background and border colors by variant
  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let backgroundColor: string = colors.primary;
    let borderColor: string = 'transparent';
    let borderWidth = 0;

    switch (variant) {
      case 'primary':
        backgroundColor = pressed ? colors.primaryPressed : colors.primary;
        break;
      case 'secondary':
        backgroundColor = pressed ? colors.border : colors.surfaceSecondary;
        borderColor = colors.border;
        borderWidth = 1;
        break;
      case 'ghost':
        backgroundColor = pressed ? colors.surfaceMuted : 'transparent';
        break;
      case 'danger':
        backgroundColor = pressed ? '#B91C1C' : colors.semantic.danger;
        break;
      case 'outline':
        backgroundColor = pressed ? colors.primaryLight : 'transparent';
        borderColor = colors.primary;
        borderWidth = 1.5;
        break;
    }

    if (disabled) {
      backgroundColor = colors.surfaceMuted;
      borderColor = 'transparent';
    }

    const height = size === 'lg' ? 54 : size === 'md' ? 44 : 36;
    const paddingHorizontal = size === 'sm' ? spacing.md : spacing.lg;

    return {
      backgroundColor,
      borderColor,
      borderWidth,
      height,
      minHeight: touchTarget.minHeight,
      paddingHorizontal,
      borderRadius: size === 'lg' ? radii.lg : radii.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: fullWidth ? 'stretch' : 'flex-start',
      opacity: disabled ? 0.6 : 1,
    };
  };

  // Label color by variant
  const getLabelColor = (): string => {
    if (disabled) return colors.text.muted;
    if (textColor) return textColor;
    switch (variant) {
      case 'primary':
      case 'danger':
        return colors.text.inverse;
      case 'outline':
      case 'ghost':
        return colors.primary;
      case 'secondary':
        return colors.text.primary;
    }
  };

  return (
    <AnimatedPressable
      onPress={isInteractive ? onPress : undefined}
      onPressIn={() => {
        setPressed(true);
        if (isInteractive) handlers.onPressIn?.();
      }}
      onPressOut={() => {
        setPressed(false);
        handlers.onPressOut?.();
      }}
      style={[getContainerStyle(pressed), style, { transform: [{ scale }] }]}
      accessibilityRole="button"
      testID={testID}
      accessibilityState={{ disabled: !isInteractive }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary}
        />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text
            variant={size === 'sm' ? 'captionMedium' : 'headline'}
            color={getLabelColor()}
            weight="700"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {label}
          </Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});
