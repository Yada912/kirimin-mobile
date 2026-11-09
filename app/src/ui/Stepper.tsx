import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii, spacing, touchTarget } from '../theme/tokens';
import { Text } from './Text';

export interface StepHeaderProps {
  steps: string[];
  currentStep: number; // 1-based index
  style?: ViewStyle;
}

export function StepHeader({ steps, currentStep, style }: StepHeaderProps) {
  return (
    <View style={[styles.headerContainer, style]}>
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;

        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.circle,
                  isActive && styles.activeCircle,
                  isDone && styles.doneCircle,
                ]}
              >
                <Text
                  variant="captionMedium"
                  color={isActive || isDone ? colors.text.inverse : colors.text.muted}
                >
                  {isDone ? '✓' : String(stepNum)}
                </Text>
              </View>
              <Text
                variant="caption"
                color={isActive ? colors.primary : isDone ? colors.text.primary : colors.text.muted}
                weight={isActive ? '600' : '400'}
                style={styles.stepLabel}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
            {idx < steps.length - 1 && (
              <View style={[styles.connector, isDone && styles.doneConnector]} />
            )}
          </React.Fragment>
        );
      })}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
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
