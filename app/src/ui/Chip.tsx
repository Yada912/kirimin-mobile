import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii, spacing, touchTarget } from '../theme/tokens';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, sublabel, selected = false, onPress, style }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selectedChip : styles.unselectedChip,
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text
        variant="calloutSemibold"
        color={selected ? colors.primary : colors.text.primary}
      >
        {label}
      </Text>
      {sublabel && (
        <Text
          variant="caption"
          color={selected ? colors.primary : colors.text.muted}
          style={styles.sublabel}
        >
          {sublabel}
        </Text>
      )}
    </Pressable>
  );
}

export interface ChipGroupItem<T> {
  value: T;
  label: string;
  sublabel?: string;
}

export interface ChipGroupProps<T> {
  items: ChipGroupItem<T>[];
  value?: T | T[];
  onChange: (val: any) => void;
  multiSelect?: boolean;
  style?: ViewStyle;
}

export function ChipGroup<T>({
  items,
  value,
  onChange,
  multiSelect = false,
  style,
}: ChipGroupProps<T>) {
  const isSelected = (itemVal: T) => {
    if (multiSelect && Array.isArray(value)) {
      return value.includes(itemVal);
    }
    return value === itemVal;
  };

  const handlePress = (itemVal: T) => {
    if (multiSelect) {
      const arr = Array.isArray(value) ? [...value] : [];
      const idx = arr.indexOf(itemVal);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        arr.push(itemVal);
      }
      onChange(arr);
    } else {
      onChange(itemVal);
    }
  };

  return (
    <View style={[styles.group, style]}>
      {items.map((item) => (
        <Chip
          key={String(item.value)}
          label={item.label}
          sublabel={item.sublabel}
          selected={isSelected(item.value)}
          onPress={() => handlePress(item.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1.5,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  selectedChip: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  unselectedChip: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sublabel: {
    marginLeft: spacing.xs,
  },
});

