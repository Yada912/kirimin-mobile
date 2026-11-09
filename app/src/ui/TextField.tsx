import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, radii, spacing, touchTarget, typography } from '../theme/tokens';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helper?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export function TextField({
  label,
  error,
  helper,
  leftElement,
  rightElement,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text variant="captionMedium" color={colors.text.secondary} style={styles.label}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          !!error && styles.errorBorder,
          rest.multiline && styles.multilineWrapper,
        ]}
      >
        {leftElement && <View style={styles.left}>{leftElement}</View>}

        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={colors.text.muted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {rightElement && <View style={styles.right}>{rightElement}</View>}
      </View>

      {error ? (
        <Text variant="caption" color={colors.semantic.danger} style={styles.errorText}>
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" color={colors.text.muted} style={styles.helperText}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  multilineWrapper: {
    minHeight: 88,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  focused: {
    borderColor: colors.primary,
  },
  errorBorder: {
    borderColor: colors.semantic.danger,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  left: {
    marginRight: spacing.sm,
  },
  right: {
    marginLeft: spacing.sm,
  },
  errorText: {
    marginTop: 4,
  },
  helperText: {
    marginTop: 4,
  },
});

