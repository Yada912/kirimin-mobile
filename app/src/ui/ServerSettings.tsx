import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors, radii, spacing } from '../theme/tokens';
import { Text } from './Text';
import { TextField } from './TextField';
import { Button } from './Button';
import { BottomSheet } from './BottomSheet';
import { Radio } from './icons';
import {
  API_BASE_URL,
  getApiBaseUrl,
  getSavedServerUrl,
  normalizeServerUrl,
  setServerUrl,
  testServer,
} from '../utils/config';
import { useAuth } from '../auth/AuthContext';

type Status = { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok'; ms: number } | { kind: 'fail'; message: string };

/**
 * Lets anyone with the APK point it at the backend running on a PC:
 * the address the server prints ("Phone: http://192.168.x.x:3000") on the same Wi-Fi,
 * or a tunnel URL (https://…trycloudflare.com) from any network.
 */
export function ServerSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { token, logout } = useAuth();
  const [value, setValue] = useState('');
  const [active, setActive] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    if (!visible) return;
    setStatus({ kind: 'idle' });
    Promise.all([getSavedServerUrl(), getApiBaseUrl()]).then(([saved, current]) => {
      setValue(saved || '');
      setActive(current);
    });
  }, [visible]);

  const check = async () => {
    setStatus({ kind: 'checking' });
    try {
      const ms = await testServer(value || active);
      setStatus({ kind: 'ok', ms });
      return true;
    } catch (err: any) {
      setStatus({ kind: 'fail', message: err?.message || 'Tidak bisa terhubung' });
      return false;
    }
  };

  const save = async () => {
    const next = value.trim() ? normalizeServerUrl(value) : null;
    if (next && !(await check())) return;
    const changed = (next || API_BASE_URL) !== active;
    await setServerUrl(next);
    if (changed) {
      // Accounts live on the server, so a session from another server is not valid here.
      if (token) await logout();
      queryClient.clear();
    }
    onClose();
  };

  const reset = async () => {
    setValue('');
    await setServerUrl(null);
    queryClient.clear();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Alamat server">
      <Text variant="callout" color={colors.text.secondary} style={{ marginBottom: spacing.md }}>
        Isi alamat yang muncul saat server dijalankan di PC. Di Wi-Fi yang sama pakai alamat “Phone”, dari
        jaringan lain pakai alamat tunnel (https://…).
      </Text>

      <TextField
        label="Alamat"
        placeholder="192.168.1.5:3000 atau https://….trycloudflare.com"
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setStatus({ kind: 'idle' });
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        testID="server-url-input"
      />

      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor:
                status.kind === 'ok'
                  ? colors.sawah
                  : status.kind === 'fail'
                    ? colors.semantic.danger
                    : colors.text.muted,
            },
          ]}
        />
        <Text variant="caption" color={status.kind === 'fail' ? colors.semantic.danger : colors.text.secondary} style={{ flex: 1 }}>
          {status.kind === 'ok'
            ? `Terhubung (${status.ms} ms)`
            : status.kind === 'fail'
              ? status.message
              : status.kind === 'checking'
                ? 'Mengecek…'
                : `Sekarang: ${active || '…'}`}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Cek" variant="secondary" size="md" fullWidth={false} style={{ flex: 1 }} onPress={check} loading={status.kind === 'checking'} />
        <Button label="Simpan" size="md" fullWidth={false} style={{ flex: 2 }} onPress={save} testID="server-url-save" />
      </View>
      <Pressable onPress={reset} hitSlop={8} style={{ alignSelf: 'center', marginTop: spacing.md }}>
        <Text variant="calloutSemibold" color={colors.primary}>
          Pakai alamat bawaan
        </Text>
      </Pressable>
    </BottomSheet>
  );
}

/** Small pill showing which server the app talks to; tap to change it. */
export function ServerChip({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [online, setOnline] = useState<boolean | null>(null);

  const refresh = async () => {
    const url = await getApiBaseUrl();
    setLabel(url.replace(/^https?:\/\//, ''));
    try {
      await testServer(url, 3000);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [open]);

  const fg = tone === 'dark' ? '#FFFFFF' : colors.text.secondary;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.chip, tone === 'dark' ? styles.chipDark : styles.chipLight]}
        hitSlop={6}
        testID="server-chip"
      >
        <Radio size={14} color={online === false ? colors.senja : online ? colors.sawah : fg} />
        <Text variant="caption" color={fg} weight="600" numberOfLines={1} style={{ marginLeft: 6, maxWidth: 200 }}>
          {online === false ? 'Server tidak terjangkau' : label || 'Server'}
        </Text>
      </Pressable>
      <ServerSettingsSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  chipLight: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipDark: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
