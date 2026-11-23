import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../src/theme/tokens';
import { Text, Button, BrandLogo, SearahScene, ServerChip } from '../../src/ui';

export default function WelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const sceneHeight = Math.round(Math.min(height * 0.46, width * 0.78));

  return (
    <View style={styles.root}>
      {/* The product in one picture: a road, two pins, someone already going that way. */}
      <View style={[styles.scene, { height: sceneHeight }]}>
        <SearahScene width={width} height={sceneHeight} />
        <SafeAreaView edges={['top']} style={styles.sceneTop}>
          <BrandLogo size="md" tone="light" testID="welcome-brand-logo" />
        </SafeAreaView>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.body}>
        <View>
          <Text variant="display" color={colors.laut}>
            Titip paket ke yang searah.
          </Text>
          <Text variant="body" color={colors.text.secondary} style={styles.lead}>
            Pengendara yang memang lewat rutemu ikut membawakan paket. Lebih murah dari kurir, dan
            paket hanya diserahkan dengan kode 4 digit.
          </Text>
        </View>

        <View>
          <Button
            label="Buat akun"
            size="lg"
            onPress={() => router.push('/(auth)/register')}
            testID="welcome-register-btn"
          />
          <Button
            label="Saya sudah punya akun"
            variant="ghost"
            size="lg"
            onPress={() => router.push('/(auth)/login')}
            style={{ marginTop: spacing.xs }}
            testID="welcome-login-btn"
          />
          <View style={{ marginTop: spacing.md }}>
            <ServerChip />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scene: {
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: colors.laut,
  },
  sceneTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  lead: {
    marginTop: spacing.md,
    maxWidth: 340,
  },
});
