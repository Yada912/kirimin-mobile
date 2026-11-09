import React from 'react';
import { Modal, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';

export interface DialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  style?: ViewStyle;
}

export function Dialog({
  visible,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  isDestructive = false,
  onConfirm,
  onCancel,
  style,
}: DialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.box, style]}>
          <Text variant="title" color={colors.text.primary} weight="700" style={styles.title}>
            {title}
          </Text>
          <Text variant="body" color={colors.text.secondary} style={styles.message}>
            {message}
          </Text>
          <View style={styles.buttonRow}>
            <Button
              label={cancelLabel}
              variant="secondary"
              size="md"
              fullWidth={false}
              onPress={onCancel}
              style={styles.btn}
            />
            <Button
              label={confirmLabel}
              variant={isDestructive ? 'danger' : 'primary'}
              size="md"
              fullWidth={false}
              onPress={onConfirm}
              style={styles.btn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  box: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    marginBottom: spacing.xs,
  },
  message: {
    marginBottom: spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  btn: {
    minWidth: 90,
  },
});
