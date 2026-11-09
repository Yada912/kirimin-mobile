import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { resolveApiUrl } from '../utils/config';
import { Text } from './Text';

export interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ name, url, size = 40, style }: AvatarProps) {
  const resolvedUrl = resolveApiUrl(url);

  const initials = name
    ? name
        .trim()
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  if (resolvedUrl) {
    return (
      <View style={[containerStyle, style]}>
        <Image
          source={{ uri: resolvedUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <Text
        variant="captionMedium"
        color={colors.primary}
        weight="700"
        style={{ fontSize: size * 0.4 }}
      >
        {initials}
      </Text>
    </View>
  );
}
