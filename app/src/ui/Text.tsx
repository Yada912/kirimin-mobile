import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from 'react-native';
import { colors, typography, fontFor } from '../theme/tokens';

export type TextVariant = keyof typeof typography;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
  children: React.ReactNode;
}

/**
 * All copy goes through this component so it always renders in Plus Jakarta Sans.
 * The effective weight (variant → weight prop → style.fontWeight) picks the font file.
 */
export function Text({
  variant = 'body',
  color = colors.text.primary,
  align,
  weight,
  style,
  children,
  ...rest
}: TextProps) {
  const variantStyle = typography[variant] || typography.body;
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  const effectiveWeight = flat.fontWeight ?? weight ?? variantStyle.fontWeight;

  return (
    <RNText
      style={[
        variantStyle,
        { color },
        align ? { textAlign: align } : undefined,
        style,
        { fontFamily: fontFor(effectiveWeight as string), fontWeight: undefined },
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
