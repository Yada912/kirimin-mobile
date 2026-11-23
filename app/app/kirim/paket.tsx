import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Image, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from '../../src/ui/icons';
import {
  CATEGORIES,
  Category,
  PACKAGE_SIZES,
  PackageSize,
  PACKAGE_SIZE_INFO,
  WEIGHT_CLASSES,
  WeightClass,
  WEIGHT_LABELS,
  HANDLING_FLAGS,
  HandlingFlag,
  HANDLING_LABELS,
} from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  StepHeader,
  ChipGroup,
  TextField,
  Button,
  Card,
} from '../../src/ui';
import { uploadImage } from '../../src/api/client';
import { resolveApiUrl } from '../../src/utils/config';
import { KIRIM_STEPS } from '../../src/features/kirim/draft';

export default function KirimPaketScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const initialCat = CATEGORIES.includes(params.categoryPreset as Category)
    ? (params.categoryPreset as Category)
    : 'Dokumen';
  const initialSize = PACKAGE_SIZES.includes(params.sizePreset as PackageSize)
    ? (params.sizePreset as PackageSize)
    : 'XS';

  const [category, setCategory] = useState<Category>(initialCat);
  const [size, setSize] = useState<PackageSize>(initialSize);
  const [weightClass, setWeightClass] = useState<WeightClass>('lt1');
  const [handling, setHandling] = useState<HandlingFlag[]>([]);
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const localUri = result.assets[0].uri;
        setPhotoUri(localUri);
        setUploading(true);
        try {
          const uploaded = await uploadImage(localUri);
          setPhotoUrl(uploaded);
        } catch (err: any) {
          alert(err.message || 'Gagal mengunggah foto');
        } finally {
          setUploading(false);
        }
      }
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  const handleNext = () => {
    // Step 2 → 3: keep everything chosen on the route step and add the package.
    router.push({
      pathname: '/kirim/driver',
      params: {
        ...params,
        category,
        size,
        weightClass,
        handling: JSON.stringify(handling),
        notes,
        photoUrl: photoUrl || '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title="Paketnya apa?" />
      <StepHeader steps={KIRIM_STEPS} currentStep={2} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Kategori Paket */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Isinya
          </Text>
          <ChipGroup<Category>
            items={CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
            value={category}
            onChange={setCategory}
          />
        </View>

        {/* Ukuran Paket */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Ukuran
          </Text>
          <ChipGroup<PackageSize>
            items={PACKAGE_SIZES.map((sz) => ({
              value: sz,
              label: PACKAGE_SIZE_INFO[sz].label,
              sublabel: `(${PACKAGE_SIZE_INFO[sz].hint})`,
            }))}
            value={size}
            onChange={setSize}
          />
        </View>

        {/* Berat Paket */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Berat
          </Text>
          <ChipGroup<WeightClass>
            items={WEIGHT_CLASSES.map((wc) => ({
              value: wc,
              label: WEIGHT_LABELS[wc],
            }))}
            value={weightClass}
            onChange={setWeightClass}
          />
        </View>

        {/* Penanganan Khusus */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Perlu perhatian khusus?
          </Text>
          <ChipGroup<HandlingFlag>
            items={HANDLING_FLAGS.map((hf) => ({
              value: hf,
              label: HANDLING_LABELS[hf],
            }))}
            value={handling}
            onChange={setHandling}
            multiSelect
          />
        </View>

        {/* Foto Paket */}
        <View style={styles.section}>
          <Text variant="headline" style={styles.sectionTitle}>
            Foto paket
          </Text>
          {photoUri ? (
            <View style={styles.photoPreviewWrapper}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <Pressable
                onPress={() => {
                  setPhotoUri(null);
                  setPhotoUrl(null);
                }}
                style={styles.removePhotoBtn}
              >
                <X size={16} color="#FFF" />
              </Pressable>
              {uploading && (
                <View style={styles.uploadingOverlay}>
                  <Text variant="captionMedium" color="#FFF">
                    Mengunggah...
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Card onPress={handlePickImage} variant="outlined" padding="md" style={styles.uploadCard}>
              <Camera size={24} color={colors.primary} />
              <Text variant="calloutSemibold" color={colors.primary} style={{ marginTop: 4 }}>
                Tambah foto
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                Opsional, membantu pengemudi mengenali paketmu
              </Text>
            </Card>
          )}
        </View>

        {/* Catatan untuk Driver */}
        <View style={styles.section}>
          <TextField
            label="Catatan untuk pengemudi"
            placeholder="Opsional, misal: telepon dulu sebelum sampai"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* Bottom Pinned Action */}
      <View style={styles.bottomBar}>
        <Button
          label="Cari pengemudi searah"
          variant="primary"
          size="lg"
          disabled={uploading}
          onPress={handleNext}
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
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  uploadCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    paddingVertical: spacing.lg,
  },
  photoPreviewWrapper: {
    position: 'relative',
    borderRadius: radii.md,
    overflow: 'hidden',
    height: 160,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
});
