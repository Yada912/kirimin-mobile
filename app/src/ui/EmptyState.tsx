import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BellArt, ChatArt, EmptyParcelArt, RouteMapArt } from './Artwork';
import { PopIn } from './motion';
import { colors, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** Which illustration to show. */
  art?: 'parcel' | 'route' | 'bell' | 'chat';
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  title,
  description,
  icon,
  art = 'parcel',
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Same illustration everywhere so empty screens feel like part of the brand. */}
      <PopIn style={styles.art}>
        {art === 'route' ? <RouteMapArt size={120} /> : art === 'bell' ? <BellArt size={120} /> : art === 'chat' ? <ChatArt size={120} /> : <EmptyParcelArt size={120} />}
      </PopIn>

      <Text variant="headline" color={colors.text.primary} weight="700" align="center" style={styles.title}>
        {title}
      </Text>

      {description && (
        <Text variant="callout" color={colors.text.secondary} align="center" style={styles.desc}>
          {description}
        </Text>
      )}

      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
          fullWidth={false}
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    marginBottom: 12,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  desc: {
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  action: {
    minWidth: 140,
  },
});

