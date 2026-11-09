import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { colors, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  message = 'Terjadi kesalahan saat memuat data.',
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconWrapper}>
        <AlertCircle size={44} color={colors.semantic.danger} />
      </View>

      <Text variant="headline" color={colors.text.primary} weight="700" align="center" style={styles.title}>
        Gagal Memuat
      </Text>

      <Text variant="callout" color={colors.text.secondary} align="center" style={styles.message}>
        {message}
      </Text>

      {onRetry && (
        <Button
          label="Coba Lagi"
          onPress={onRetry}
          variant="secondary"
          size="md"
          fullWidth={false}
          style={styles.retryBtn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.semantic.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  message: {
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  retryBtn: {
    minWidth: 120,
  },
});
