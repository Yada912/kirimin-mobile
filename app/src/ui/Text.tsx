import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from 'react-native';
import { colors, typography } from '../theme/tokens';

export type TextVariant = keyof typeof typography;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
  children: React.ReactNode;
}

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

  return (
    <RNText
      style={[
        variantStyle,
        { color },
        align ? { textAlign: align } : undefined,
        weight ? { fontWeight: weight } : undefined,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

