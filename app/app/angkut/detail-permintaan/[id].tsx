import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ShieldCheck, User, Package, MessageSquare } from 'lucide-react-native';
import { colors, radii, spacing } from '../../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  Avatar,
  Button,
  StatusPill,
  MapView,
  Divider,
  SkeletonCard,
  ErrorState,
} from '../../../src/ui';
import { useOrder, useAcceptOrder, useDeclineOrder } from '../../../src/api/hooks/useApi';
import { resolveApiUrl } from '../../../src/utils/config';
import { formatRupiah, formatDistance } from '../../../src/utils/format';

export default function AngkutDetailPermintaanScreen() {
  const router = useRouter();
  const { id, tripId } = useLocalSearchParams<{ id: string; tripId?: string }>();

  const { data: order, isLoading, isError, error, refetch } = useOrder(id);
  const { mutateAsync: acceptOrder, isPending: isAccepting } = useAcceptOrder();
  const { mutateAsync: declineOrder, isPending: isDeclining } = useDeclineOrder();

  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Detail Permintaan" />
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Detail Permintaan" />
        <ErrorState message={(error as any)?.message || 'Pesanan tidak ditemukan'} onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  const handleAccept = async () => {
    try {
      setActionError(null);
      await acceptOrder({ orderId: order.id, tripId });
      if (tripId) {
        router.replace({ pathname: '/angkut/jalan/[tripId]', params: { tripId } });
      } else {
        router.replace('/(angkut)/aktivitas');
      }
    } catch (err: any) {
      setActionError(err.message || 'Gagal menerima pesanan');
    }
  };

  const handleDecline = async () => {
    try {
      setActionError(null);
      await declineOrder({ orderId: order.id, reason: 'Rute tidak memungkinkan' });
      router.back();
    } catch (err: any) {
      setActionError(err.message || 'Gagal menolak pesanan');
    }
  };

  const photoFullUrl = resolveApiUrl(order.photoUrl);
  const driverEarning = order.price?.fee ?? 10000;

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Detail Permintaan Masuk (D4)" />

      <ScrollView contentContainerStyle={styles.content}>
        {actionError && (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {actionError}
            </Text>
          </Card>
        )}

        {/* Sender Info Card */}
        <Card variant="elevated" padding="md" style={styles.card}>
          <View style={styles.userRow}>
            <Avatar name={order.sender.name} url={order.sender.avatarUrl} size={48} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="headline" color={colors.text.primary} weight="700">
                  {order.sender.name}
                </Text>
                {order.sender.verified && (
                  <ShieldCheck size={16} color={colors.semantic.success} style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text variant="caption" color={colors.text.secondary}>
                Pengirim • {order.sender.sendsCount}x kirim paket
              </Text>
            </View>
            <StatusPill status={order.status} />
          </View>
        </Card>

        {/* Map Preview */}
        <View style={styles.mapWrapper}>
          <MapView pickup={order.pickup} dropoff={order.dropoff} height={180} />
        </View>

        {/* Earning Card */}
        <Card variant="flat" padding="md" style={styles.earningCard}>
          <View style={styles.earningRow}>
            <View>
              <Text variant="captionMedium" color={colors.semantic.success}>
                Pendapatan Pengemudi
              </Text>
              <Text variant="largeTitle" color={colors.semantic.success} weight="700">
                {formatRupiah(driverEarning)}
              </Text>
            </View>
            <Text variant="caption" color={colors.text.muted}>
              Dibayarkan saat serah terima
            </Text>
          </View>
        </Card>

        {/* Package Details */}
        <Card variant="outlined" padding="md" style={styles.card}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginBottom: spacing.sm }}>
            Rincian Barang Titipan
          </Text>
          <View style={styles.detailRow}>
            <Text variant="callout" color={colors.text.secondary}>
              Kategori & Ukuran
            </Text>
            <Text variant="calloutSemibold" color={colors.text.primary}>
              {order.category} (Ukuran {order.size})
            </Text>
          </View>

          {order.handling && order.handling.length > 0 && (
            <View style={styles.detailRow}>
              <Text variant="callout" color={colors.text.secondary}>
                Penanganan
              </Text>
              <Text variant="calloutSemibold" color={colors.semantic.warning}>
                {order.handling.join(', ')}
              </Text>
            </View>
          )}

          {order.notes ? (
            <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
              <Text variant="callout" color={colors.text.secondary}>
                Catatan
              </Text>
              <Text variant="callout" color={colors.text.primary} style={{ flex: 1, textAlign: 'right' }}>
                {order.notes}
              </Text>
            </View>
          ) : null}

          {photoFullUrl && (
            <View style={{ marginTop: spacing.md }}>
              <Text variant="caption" color={colors.text.muted} style={{ marginBottom: 4 }}>
                Foto Paket:
              </Text>
              <Image source={{ uri: photoFullUrl }} style={styles.packageImage} resizeMode="cover" />
            </View>
          )}
        </Card>

        {/* Pickup & Dropoff Address */}
        <Card variant="outlined" padding="md" style={styles.card}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={{ marginBottom: spacing.sm }}>
            Alamat Titik Temu
          </Text>
          <View style={styles.addressRow}>
            <MapPin size={18} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="caption" color={colors.text.muted}>
                Jemput
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary}>
                {order.pickup.label}
              </Text>
            </View>
          </View>
          <Divider style={{ marginVertical: spacing.sm }} />
          <View style={styles.addressRow}>
            <MapPin size={18} color={colors.semantic.success} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="caption" color={colors.text.muted}>
                Antar (Penerima: {order.recipient.name} - {order.recipient.phone})
              </Text>
              <Text variant="calloutSemibold" color={colors.text.primary}>
                {order.dropoff.label}
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Decision Buttons */}
      <View style={styles.bottomBar}>
        <Button
          label="Tolak"
          variant="secondary"
          size="lg"
          loading={isDeclining}
          disabled={isAccepting}
          onPress={handleDecline}
          style={styles.actionBtn}
        />
        <Button
          label="Terima Titipan"
          variant="primary"
          size="lg"
          loading={isAccepting}
          disabled={isDeclining}
          onPress={handleAccept}
          style={[styles.actionBtn, { flex: 2 }]}
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
  content: {
    padding: spacing.lg,
    paddingBottom: 110,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapWrapper: {
    marginBottom: spacing.md,
  },
  earningCard: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: spacing.md,
  },
  earningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  packageImage: {
    width: '100%',
    height: 160,
    borderRadius: radii.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  actionBtn: {
    flex: 1,
  },
});

