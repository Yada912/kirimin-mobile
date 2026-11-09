import React, { useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
  Pressable,
} from 'react-native';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { Text } from './Text';

export interface CodeInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  style?: ViewStyle;
  /** For E2E tests: the tappable boxes get `${testID}`, the hidden input `${testID}-input`. */
  testID?: string;
}

export function CodeInput({
  value,
  onChange,
  length = 4,
  style,
  testID,
}: CodeInputProps) {
  const inputRef = useRef<any>(null);

  const digits = value.split('').slice(0, length);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.container, style]}>
      <Pressable onPress={handlePress} style={styles.boxesRow} testID={testID}>
        {Array.from({ length }).map((_, i) => {
          const char = digits[i] || '';
          const isFocused = i === digits.length;

          return (
            <View
              key={i}
              style={[
                styles.box,
                isFocused && styles.boxFocused,
                !!char && styles.boxFilled,
              ]}
            >
              <Text variant="largeTitle" color={colors.text.primary} weight="700">
                {char}
              </Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        testID={testID ? `${testID}-input` : undefined}
        value={value}
        onChangeText={(text) => {
          const cleaned = text.replace(/[^0-9]/g, '').slice(0, length);
          onChange(cleaned);
        }}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        caretHidden
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  box: {
    width: 54,
    height: 64,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  boxFilled: {
    borderColor: colors.primary,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
