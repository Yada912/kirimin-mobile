import React, { useState } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Copy, Check } from 'lucide-react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { Text } from './Text';

export interface CodeDisplayProps {
  code: string;
  label?: string;
  hint?: string;
  style?: ViewStyle;
  /** For E2E tests. */
  testID?: string;
}

export function CodeDisplay({
  code,
  label = 'Kode Serah Terima',
  hint = 'Berikan kode 4 digit ini ke penerima untuk ditunjukkan ke driver.',
  style,
  testID,
}: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const digits = code.padStart(4, '-').split('');

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text variant="captionMedium" color={colors.text.secondary} align="center" style={styles.label}>
          {label}
        </Text>
      )}

      <Pressable onPress={handleCopy} style={styles.codeRow} testID={testID} accessibilityLabel={`Kode ${code}`}>
        {digits.map((digit, i) => (
          <View key={i} style={styles.digitBox}>
            <Text variant="largeTitle" color={colors.primary} weight="700">
              {digit}
            </Text>
          </View>
        ))}
      </Pressable>

      <View style={styles.copyRow}>
        {copied ? (
          <>
            <Check size={14} color={colors.semantic.success} />
            <Text variant="caption" color={colors.semantic.success} style={styles.copyText}>
              Kode tersalin!
            </Text>
          </>
        ) : (
          <Pressable onPress={handleCopy} style={styles.copyBtn}>
            <Copy size={14} color={colors.primary} />
            <Text variant="caption" color={colors.primary} style={styles.copyText}>
              Salin kode
            </Text>
          </Pressable>
        )}
      </View>

      {hint && (
        <Text variant="caption" color={colors.text.muted} align="center" style={styles.hint}>
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primarySubtle,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  label: {
    marginBottom: spacing.sm,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  digitBox: {
    width: 48,
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyText: {
    marginLeft: 4,
  },
  hint: {
    marginTop: spacing.sm,
    maxWidth: 260,
  },
});

