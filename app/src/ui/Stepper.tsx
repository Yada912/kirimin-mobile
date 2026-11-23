import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii, spacing, touchTarget } from '../theme/tokens';
import { Text } from './Text';

export interface StepHeaderProps {
  steps: string[];
  currentStep: number; // 1-based index
  style?: ViewStyle;
}

/**
 * Wizard progress: one thin segment per step, the current step's name underneath.
 * Compact on purpose (≈40px) so the step's own content — especially maps — gets the space.
 */
export function StepHeader({ steps, currentStep, style }: StepHeaderProps) {
  return (
    <View style={[styles.headerContainer, style]} accessibilityRole="progressbar">
      <View style={styles.segments}>
        {steps.map((label, idx) => {
          const n = idx + 1;
          return (
            <View
              key={label}
              style={[
                styles.segment,
                n < currentStep && styles.segmentDone,
                n === currentStep && styles.segmentActive,
              ]}
            />
          );
        })}
      </View>
      <View style={styles.segmentLabels}>
        {steps.map((label, idx) => {
          const n = idx + 1;
          return (
            <Text
              key={label}
              variant="caption"
              weight={n === currentStep ? '700' : '500'}
              color={n === currentStep ? colors.primary : n < currentStep ? colors.text.secondary : colors.text.muted}
              style={styles.segmentLabel}
              numberOfLines={1}
            >
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

export interface NumericStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  label?: string;
  unit?: string;
  style?: ViewStyle;
}

export function NumericStepper({
  value,
  min = 1,
  max = 10,
  onChange,
  label,
  unit,
  style,
}: NumericStepperProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View style={[styles.numericRow, style]}>
      {label && (
        <View style={styles.labelCol}>
          <Text variant="headline" color={colors.text.primary}>
            {label}
          </Text>
        </View>
      )}
      <View style={styles.controlsRow}>
        <Pressable
          onPress={() => canDecrement && onChange(value - 1)}
          disabled={!canDecrement}
          style={({ pressed }) => [
            styles.btn,
            !canDecrement && styles.btnDisabled,
            pressed && canDecrement && { opacity: 0.7 },
          ]}
        >
          <Text variant="title" color={canDecrement ? colors.primary : colors.text.muted}>
            −
          </Text>
        </Pressable>

        <View style={styles.valueBox}>
          <Text variant="headline" color={colors.text.primary}>
            {value} {unit}
          </Text>
        </View>

        <Pressable
          onPress={() => canIncrement && onChange(value + 1)}
          disabled={!canIncrement}
          style={({ pressed }) => [
            styles.btn,
            !canIncrement && styles.btnDisabled,
            pressed && canIncrement && { opacity: 0.7 },
          ]}
        >
          <Text variant="title" color={canIncrement ? colors.primary : colors.text.muted}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
  },
  segmentDone: {
    backgroundColor: colors.langit,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentLabels: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  segmentLabel: {
    flex: 1,
  },
  stepItem: {
    alignItems: 'center',
    minWidth: 48,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeCircle: {
    backgroundColor: colors.primary,
  },
  doneCircle: {
    backgroundColor: colors.semantic.success,
  },
  stepLabel: {
    fontSize: 11,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
    marginBottom: 16,
  },
  doneConnector: {
    backgroundColor: colors.semantic.success,
  },
  numericRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  labelCol: {
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  valueBox: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});

