import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import {
  OrderStatus,
  ORDER_STATUS_LABELS,
  TripStatus,
  TRIP_STATUS_LABELS,
} from '@kirimin/shared';
import { colors, radii, spacing } from '../theme/tokens';
import { Text } from './Text';

export interface StatusPillProps {
  status: OrderStatus | TripStatus;
  customLabel?: string;
  style?: ViewStyle;
}

export function StatusPill({ status, customLabel, style }: StatusPillProps) {
  const isTripStatus = status in TRIP_STATUS_LABELS;
  const label =
    customLabel ||
    (isTripStatus
      ? TRIP_STATUS_LABELS[status as TripStatus]
      : ORDER_STATUS_LABELS[status as OrderStatus]) ||
    String(status);

  const getStatusColor = () => {
    switch (status) {
      case 'open':
      case 'requested':
        return { text: colors.status.requested, bg: colors.status.requestedBg };
      case 'declined':
      case 'cancelled':
      case 'expired':
        return { text: colors.semantic.danger, bg: colors.semantic.dangerLight };
      case 'accepted':
      case 'picked_up':
      case 'in_transit':
      case 'ongoing':
      case 'published':
        return { text: colors.primary, bg: colors.primaryLight };
      case 'arrived':
      case 'delivered':
      case 'completed':
        return { text: colors.semantic.success, bg: colors.semantic.successLight };
      default:
        return { text: colors.text.secondary, bg: colors.surfaceMuted };
    }
  };

  const { text, bg } = getStatusColor();

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text variant="captionMedium" color={text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
});
