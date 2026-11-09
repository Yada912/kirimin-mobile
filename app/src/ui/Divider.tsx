import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/tokens';

export interface DividerProps {
  color?: string;
  style?: ViewStyle;
}

export function Divider({ color = colors.borderLight, style }: DividerProps) {
  return <View style={[styles.line, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});

