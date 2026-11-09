import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { colors } from '../src/theme/tokens';
import { Text } from '../src/ui/Text';

export default function Index() {
  const { user, token, activeRole, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!token || !user) {
      router.replace('/(auth)/welcome');
    } else if (activeRole === 'driver') {
      router.replace('/(angkut)/beranda');
    } else {
      router.replace('/(kirim)/beranda');
    }
  }, [token, user, activeRole, isLoading, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="callout" color={colors.text.secondary} style={styles.text}>
        Memuat Kirimin...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  text: {
    marginTop: 12,
  },
});
