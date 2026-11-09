import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, spacing, touchTarget } from '../theme/tokens';
import { Text } from './Text';
import { IconButton } from './IconButton';

export interface TopBarProps {
  title?: string;
  subtitle?: string;
  canGoBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function TopBar({
  title,
  subtitle,
  canGoBack = true,
  onBack,
  rightAction,
  style,
}: TopBarProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        {canGoBack && (
          <IconButton
            icon={<ChevronLeft size={24} color={colors.text.primary} />}
            onPress={handleBack}
            accessibilityLabel="Kembali"
          />
        )}
      </View>

      <View style={styles.center}>
        {title && (
          <Text
            variant="headline"
            color={colors.text.primary}
            weight="700"
            align="center"
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        {subtitle && (
          <Text
            variant="caption"
            color={colors.text.secondary}
            align="center"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.right}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  left: {
    width: touchTarget.minWidth,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    width: touchTarget.minWidth,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});

