import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { OrderStatus, TRACKING_STEPS, ORDER_STATUS_LABELS } from '@kirimin/shared';
import { colors, radii, spacing } from '../theme/tokens';
import { Text } from './Text';

export interface ProgressStepsProps {
  currentStatus: OrderStatus;
  style?: ViewStyle;
}

export function ProgressSteps({ currentStatus, style }: ProgressStepsProps) {
  // If cancelled or expired, show special indicator
  const isTerminated = currentStatus === 'cancelled' || currentStatus === 'expired';
  const currentIndex = TRACKING_STEPS.indexOf(currentStatus);

  return (
    <View style={[styles.container, style]}>
      {TRACKING_STEPS.map((step, idx) => {
        const isDone = !isTerminated && currentIndex >= idx;
        const isCurrent = !isTerminated && currentIndex === idx;

        // Custom short labels for horizontal fit
        const shortLabels: Record<string, string> = {
          accepted: 'Diterima',
          picked_up: 'Dijemput',
          in_transit: 'Jalan',
          arrived: 'Tiba',
          delivered: 'Selesai',
        };

        return (
          <React.Fragment key={step}>
            <View style={styles.stepCol}>
              <View
                style={[
                  styles.circle,
                  isDone && styles.circleDone,
                  isCurrent && styles.circleCurrent,
                ]}
              >
                <Text
                  variant="caption"
                  color={isDone ? colors.text.inverse : colors.text.muted}
                  weight="700"
                >
                  {isDone ? '✓' : String(idx + 1)}
                </Text>
              </View>
              <Text
                variant="caption"
                color={isCurrent ? colors.primary : isDone ? colors.text.primary : colors.text.muted}
                weight={isCurrent ? '700' : '400'}
                align="center"
                style={styles.label}
              >
                {shortLabels[step] || ORDER_STATUS_LABELS[step]}
              </Text>
            </View>

            {idx < TRACKING_STEPS.length - 1 && (
              <View
                style={[
                  styles.line,
                  !isTerminated && currentIndex > idx && styles.lineDone,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  stepCol: {
    alignItems: 'center',
    width: 52,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  circleDone: {
    backgroundColor: colors.semantic.success,
  },
  circleCurrent: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 11,
  },
  line: {
    flex: 1,
    height: 3,
    backgroundColor: colors.border,
    marginBottom: 16,
    marginHorizontal: -4,
  },
  lineDone: {
    backgroundColor: colors.semantic.success,
  },
});
