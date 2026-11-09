import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bike, ShieldCheck, Clock, Users, ArrowRight } from 'lucide-react-native';
import type { TripMatch } from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  StepHeader,
  Card,
  Avatar,
  Button,
  StatusPill,
  SkeletonCard,
  EmptyState,
  ErrorState,
} from '../../src/ui';
import { api } from '../../src/api/client';
import { formatRupiah, formatTime, formatDetour, formatSimilarity } from '../../src/utils/format';
import { readKirimDraft, searchPayload } from '../../src/features/kirim/draft';

export default function KirimDriverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directMatches, setDirectMatches] = useState<TripMatch[]>([]);
  const [detourMatches, setDetourMatches] = useState<TripMatch[]>([]);

  const searchDrivers = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.post<{ direct: TripMatch[]; detour: TripMatch[] }>(
        '/matches/search',
        searchPayload(readKirimDraft(params)),
      );

      setDirectMatches(res.direct || []);
      setDetourMatches(res.detour || []);
    } catch (err: any) {
      setError(err.message || 'Gagal mencari driver searah');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchDrivers();
  }, []);

  const handleSelectDriver = (match: TripMatch) => {
    router.push({
      pathname: '/kirim/konfirmasi',
      params: {
        ...params,
        tripId: match.trip.id,
        matchData: JSON.stringify(match),
      },
    });
  };

  const handlePostOpen = () => {
    router.push({
      pathname: '/kirim/konfirmasi',
      params: {
        ...params,
        tripId: '', // Omit tripId for open request (S6)
      },
    });
  };

  const renderMatchCard = (match: TripMatch, isDirect: boolean) => (
    <Card
      key={match.trip.id}
      onPress={() => handleSelectDriver(match)}
      style={styles.driverCard}
    >
      <View style={styles.cardHeader}>
        <View style={styles.driverInfoRow}>
          <Avatar name={match.trip.driver.name} url={match.trip.driver.avatarUrl} size={48} />
          <View style={styles.driverDetails}>
            <View style={styles.nameRow}>
              <Text variant="headline" color={colors.text.primary} weight="700">
                {match.trip.driver.name}
              </Text>
              {match.trip.driver.verified && (
                <ShieldCheck size={16} color={colors.semantic.success} style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text variant="caption" color={colors.text.secondary}>
              {match.trip.vehicle.plate} • Rating {match.trip.driver.ratingAvg?.toFixed(1) || '5.0'} ★ ({match.trip.driver.deliveriesCount} antar)
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.matchBadge,
            { backgroundColor: isDirect ? colors.primaryLight : colors.semantic.warningLight },
          ]}
        >
          <Text
            variant="captionMedium"
            color={isDirect ? colors.primary : colors.semantic.warning}
          >
            {isDirect ? `${formatSimilarity(match.similarity)} searah` : formatDetour(match.detourKm, match.detourMinutes)}
          </Text>
        </View>
      </View>

      <View style={styles.timeRow}>
        <Clock size={14} color={colors.text.muted} />
        <Text variant="caption" color={colors.text.secondary} style={{ marginLeft: 4 }}>
          Berangkat: {formatTime(match.trip.departAt)} • Estimasi tiba: {formatTime(match.eta.dropoffAt)}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text variant="caption" color={colors.text.muted}>
            Total Biaya
          </Text>
          <Text variant="headline" color={colors.primary} weight="700">
            {formatRupiah(match.price.total)}
          </Text>
        </View>
        <Button
          label="Pilih Driver"
          variant="primary"
          size="sm"
          fullWidth={false}
          onPress={() => handleSelectDriver(match)}
        />
      </View>
    </Card>
  );

  const totalMatches = directMatches.length + detourMatches.length;

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Driver Searah (S3)" />
      <StepHeader
        steps={['Paket', 'Rute', 'Driver', 'Konfirmasi']}
        currentStep={3}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              searchDrivers();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={searchDrivers} />
        ) : (
          <>
            {/* Direct matches */}
            {directMatches.length > 0 && (
              <View style={styles.section}>
                <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
                  Driver Searah Langsung ({directMatches.length})
                </Text>
                <View style={styles.list}>
                  {directMatches.map((m) => renderMatchCard(m, true))}
                </View>
              </View>
            )}

            {/* Detour matches */}
            {detourMatches.length > 0 && (
              <View style={styles.section}>
                <Text variant="headline" color={colors.text.primary} weight="700" style={styles.sectionTitle}>
                  Driver dengan Simpangan Rute ({detourMatches.length})
                </Text>
                <View style={styles.list}>
                  {detourMatches.map((m) => renderMatchCard(m, false))}
                </View>
              </View>
            )}

            {/* If no matches found */}
            {totalMatches === 0 && (
              <EmptyState
                title="Belum Ada Driver yang Pas"
                description="Belum ada pengemudi terjadwal di rute dan jam yang Anda pilih."
                icon={<Bike size={44} color={colors.text.muted} />}
              />
            )}

            {/* Open Request Option */}
            <Card variant="flat" padding="lg" style={styles.openRequestCard}>
              <Text variant="headline" color={colors.text.primary} weight="700">
                Tidak menemukan jadwal yang cocok?
              </Text>
              <Text variant="callout" color={colors.text.secondary} style={styles.openDesc}>
                Posting sebagai permintaan terbuka. Pengemudi lain yang melihat rute ini dapat menerima pesanan Anda.
              </Text>
              <Button
                label="Posting Permintaan Terbuka"
                variant="outline"
                size="md"
                onPress={handlePostOpen}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          </>
        )}
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  driverCard: {
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginLeft: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  openRequestCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  openDesc: {
    marginTop: 4,
  },
});
