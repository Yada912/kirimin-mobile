import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { Text, TopBar, Card, Avatar, Button, ChipGroup, TextField, SkeletonCard, ErrorState } from '../../src/ui';
import { useOrder, useRateOrder } from '../../src/api/hooks/useApi';

const RATING_TAGS = [
  'Tepat Waktu',
  'Sangat Ramah',
  'Paket Terjaga Aman',
  'Komunikasi Cepat',
  'Rekomendasi',
];

export default function RatingScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const { data: order, isLoading } = useOrder(orderId);
  const { mutateAsync: rateOrder, isPending } = useRateOrder();

  const [stars, setStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Tepat Waktu', 'Paket Terjaga Aman']);
  const [comment, setComment] = useState('');
  const [rateError, setRateError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setRateError(null);
      await rateOrder({
        orderId,
        stars,
        tags: selectedTags,
        comment: comment.trim() || 'Pelayanan sangat memuaskan.',
      });
      router.replace('/(kirim)/aktivitas');
    } catch (err: any) {
      setRateError(err.message || 'Gagal mengirimkan rating');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Beri Penilaian" />
        <View style={styles.content}>
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  const driverName = order?.driver?.name || 'Driver';

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Beri Penilaian (X3)" />

      <ScrollView contentContainerStyle={styles.content}>
        {rateError && (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {rateError}
            </Text>
          </Card>
        )}

        {/* Driver Card */}
        <Card variant="elevated" padding="lg" style={styles.driverCard}>
          <Avatar name={driverName} url={order?.driver?.avatarUrl} size={64} />
          <Text variant="title" color={colors.text.primary} weight="700" style={styles.driverName}>
            {driverName}
          </Text>
          <Text variant="callout" color={colors.text.secondary} align="center">
            Bagaimana pengalaman pengiriman paket Anda bersama {driverName}?
          </Text>

          {/* Stars Row */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable key={s} onPress={() => setStars(s)} style={styles.starBtn}>
                <Star
                  size={36}
                  color={s <= stars ? '#F59E0B' : colors.border}
                  fill={s <= stars ? '#F59E0B' : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Quick Tags */}
        <View style={styles.section}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
            Apa yang paling Anda sukai?
          </Text>
          <ChipGroup<string>
            items={RATING_TAGS.map((t) => ({ value: t, label: t }))}
            value={selectedTags}
            onChange={setSelectedTags}
            multiSelect
          />
        </View>

        {/* Comment Input */}
        <View style={styles.section}>
          <TextField
            label="Komentar Tambahan"
            placeholder="Tuliskan ulasan untuk pengemudi..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
          />
        </View>

        <Button
          label="Kirim Penilaian"
          variant="primary"
          size="lg"
          loading={isPending}
          onPress={handleSubmit}
          style={styles.submitBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  driverCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginBottom: spacing.xl,
  },
  driverName: {
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  starBtn: {
    padding: 4,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  submitBtn: {
    marginBottom: spacing.xxl,
  },
});

