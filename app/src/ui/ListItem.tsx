import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, spacing, touchTarget } from '../theme/tokens';
import { Text } from './Text';

export interface ListItemProps {
  title: string;
  subtitle?: string | React.ReactNode;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  style?: ViewStyle;
}

export function ListItem({
  title,
  subtitle,
  leftIcon,
  rightElement,
  onPress,
  showChevron = false,
  style,
}: ListItemProps) {
  const content = (
    <View style={[styles.container, style]}>
      {leftIcon && <View style={styles.left}>{leftIcon}</View>}
      <View style={styles.middle}>
        <Text variant="headline" color={colors.text.primary} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <View style={styles.subtitleContainer}>
            {typeof subtitle === 'string' ? (
              <Text variant="callout" color={colors.text.secondary} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )}
          </View>
        )}
      </View>
      {(rightElement || showChevron) && (
        <View style={styles.right}>
          {rightElement}
          {showChevron && (
            <Text variant="body" color={colors.text.muted} style={styles.chevron}>
              ›
            </Text>
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && { backgroundColor: colors.surfaceMuted }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: touchTarget.minHeight,
  },
  left: {
    marginRight: spacing.md,
  },
  middle: {
    flex: 1,
  },
  subtitleContainer: {
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300',
    marginLeft: spacing.xs,
  },
});

