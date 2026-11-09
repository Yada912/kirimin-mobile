import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { colors, spacing } from '../src/theme/tokens';
import { Text, TopBar, EmptyState, Button } from '../src/ui';

export default function PlaceholderScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Segera Hadir" />
      <View style={styles.container}>
        <EmptyState
          title="Fitur Segera Hadir"
          description="Fitur ini sedang dalam tahap pengembangan dan akan tersedia pada pembaruan Kirimin selanjutnya."
          icon={<Sparkles size={48} color={colors.primary} />}
          actionLabel="Kembali"
          onAction={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
