import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  Card,
  CodeInput,
  Button,
  Divider,
  SkeletonCard,
  ErrorState,
} from '../../src/ui';
import { useOrder, useDeliverOrder } from '../../src/api/hooks/useApi';
import { uploadImage } from '../../src/api/client';

export default function SerahTerimaScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const { data: order, isLoading, isError, error } = useOrder(orderId);
  const { mutateAsync: deliverOrder, isPending: isDelivering } = useDeliverOrder();

  const [code, setCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handlePickPhoto = async () => {
    try {
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!res.canceled && res.assets[0]?.uri) {
        const local = res.assets[0].uri;
        setPhotoUri(local);
        setUploading(true);
        try {
          const uploaded = await uploadImage(local);
          setPhotoUrl(uploaded);
        } catch (err: any) {
          alert(err.message || 'Gagal mengunggah foto serah terima');
        } finally {
          setUploading(false);
        }
      }
    } catch (err) {
      console.warn('Camera error:', err);
    }
  };

  const handleSubmit = async () => {
    if (code.length < 4) {
      setDeliverError('Masukkan 4 digit kode serah terima dari penerima.');
      return;
    }

    try {
      setDeliverError(null);
      await deliverOrder({
        orderId,
        code,
        photoUrl: photoUrl || undefined,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setDeliverError(err.message || 'Kode serah terima tidak cocok. Pastikan meminta kode dari penerima.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Serah Terima" />
        <View style={styles.content}>
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar title="Serah Terima" />
        <ErrorState message={(error as any)?.message || 'Pesanan tidak ditemukan'} />
      </SafeAreaView>
    );
  }

  if (isSuccess) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <CheckCircle2 size={72} color={colors.semantic.success} />
          <Text variant="largeTitle" color={colors.text.primary} weight="700" align="center" style={styles.successTitle}>
            Paket Berhasil Diserahkan!
          </Text>
          <Text variant="callout" color={colors.text.secondary} align="center" style={styles.successDesc}>
            Kode serah terima terverifikasi. Pembayaran akan diteruskan ke saldo Anda.
          </Text>

          <Button
            label="Kembali ke Perjalanan"
            variant="primary"
            size="lg"
            onPress={() => {
              if (order.tripId) {
                router.replace({ pathname: '/angkut/jalan/[tripId]', params: { tripId: order.tripId } });
              } else {
                router.replace('/(angkut)/aktivitas');
              }
            }}
            style={styles.successBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Serah Terima Paket (X2)" />

      <ScrollView contentContainerStyle={styles.content}>
        {deliverError && (
          <Card variant="flat" padding="md" style={styles.errorCard}>
            <Text variant="callout" color={colors.semantic.danger}>
              {deliverError}
            </Text>
          </Card>
        )}

        {/* Order Info */}
        <Card variant="outlined" padding="md" style={styles.orderSummary}>
          <Text variant="headline" color={colors.text.primary} weight="700">
            Pesanan {order.code}
          </Text>
          <Text variant="callout" color={colors.text.secondary} style={{ marginTop: 2 }}>
            Penerima: {order.recipient.name} ({order.recipient.phone})
          </Text>
          <Text variant="caption" color={colors.text.muted}>
            Lokasi: {order.dropoff.label}
          </Text>
        </Card>

        {/* Code Input Section */}
        <Card variant="elevated" padding="lg" style={styles.inputCard}>
          <ShieldCheck size={32} color={colors.primary} />
          <Text variant="title" color={colors.text.primary} weight="700" align="center" style={styles.cardHeading}>
            Masukkan Kode 4 Digit
          </Text>
          <Text variant="callout" color={colors.text.secondary} align="center" style={styles.cardSub}>
            Minta penerima paket menyebutkan 4 digit kode rahasia yang tertera di aplikasi mereka.
          </Text>

          <CodeInput value={code} onChange={setCode} length={4} />
        </Card>

        {/* Proof Photo (Optional for meet, mandatory if leave at location) */}
        <View style={styles.photoSection}>
          <Text variant="headline" color={colors.text.primary} weight="700" style={styles.photoTitle}>
            Foto Bukti Serah Terima (Opsional)
          </Text>

          {photoUri ? (
            <View style={styles.photoPreviewWrapper}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <Button
                label="Foto Ulang"
                variant="secondary"
                size="sm"
                onPress={handlePickPhoto}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          ) : (
            <Card onPress={handlePickPhoto} variant="outlined" padding="md" style={styles.photoPickerCard}>
              <Camera size={24} color={colors.primary} />
              <Text variant="calloutSemibold" color={colors.primary} style={{ marginTop: 4 }}>
                Ambil Foto Paket di Lokasi
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Sebagai bukti dokumentasi pengantaran
              </Text>
            </Card>
          )}
        </View>

        {/* Complete Deliver Action */}
        <Button
          label="Konfirmasi Selesai Antar"
          variant="primary"
          size="lg"
          loading={isDelivering || uploading}
          disabled={code.length < 4}
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
  orderSummary: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  inputCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  cardHeading: {
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  cardSub: {
    maxWidth: 280,
    marginBottom: spacing.sm,
  },
  photoSection: {
    marginBottom: spacing.xl,
  },
  photoTitle: {
    marginBottom: spacing.sm,
  },
  photoPickerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    paddingVertical: spacing.lg,
  },
  photoPreviewWrapper: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: radii.md,
  },
  submitBtn: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  successTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  successDesc: {
    maxWidth: 280,
    marginBottom: spacing.xxl,
  },
  successBtn: {
    width: '100%',
  },
});

