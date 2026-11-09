import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { formatRupiah } from '../utils/format';
import { Text } from './Text';
import { Divider } from './Divider';

export interface PriceRowProps {
  fee?: number | null;
  serviceFee?: number | null;
  total?: number | null;
  compact?: boolean;
  style?: ViewStyle;
}

export function PriceRow({
  fee = 0,
  serviceFee = 0,
  total = 0,
  compact = false,
  style,
}: PriceRowProps) {
  if (compact) {
    return (
      <View style={[styles.compactRow, style]}>
        <Text variant="callout" color={colors.text.secondary}>
          Total Biaya
        </Text>
        <Text variant="title" color={colors.primary} weight="700">
          {formatRupiah(total)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <Text variant="callout" color={colors.text.secondary}>
          Ongkos titip driver
        </Text>
        <Text variant="callout" color={colors.text.primary} weight="500">
          {formatRupiah(fee)}
        </Text>
      </View>

      <View style={styles.row}>
        <Text variant="callout" color={colors.text.secondary}>
          Biaya layanan Kirimin
        </Text>
        <Text variant="callout" color={colors.text.primary} weight="500">
          {formatRupiah(serviceFee)}
        </Text>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.row}>
        <Text variant="headline" color={colors.text.primary} weight="700">
          Total Pembayaran
        </Text>
        <Text variant="headline" color={colors.primary} weight="700">
          {formatRupiah(total)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  divider: {
    marginVertical: spacing.sm,
  },
});

