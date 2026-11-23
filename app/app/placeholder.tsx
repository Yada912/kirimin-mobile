import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HelpCircle, ShieldCheck, Bike, FileText } from '../src/ui/icons';
import { colors, spacing } from '../src/theme/tokens';
import { Text, TopBar, Card, Button, Divider } from '../src/ui';
import { useAuth } from '../src/auth/AuthContext';

interface InfoItem {
  title: string;
  body: string;
}

const TOPICS: Record<string, { title: string; items: InfoItem[] }> = {
  bantuan: {
    title: 'Bantuan & Pusat Informasi',
    items: [
      {
        title: 'Cara Mengirim Paket',
        body: 'Pilih detail paket (kategori, ukuran, berat), tentukan titik jemput & antar di peta Bali, pilih pengemudi yang searah, lalu konfirmasi pesanan.',
      },
      {
        title: 'Keamanan Kode Serah Terima 4 Digit',
        body: 'Setiap pesanan dilengkapi kode rahasia 4 digit. Berikan kode ini hanya kepada penerima agar pengemudi dapat menyelesaikan pengantaran di tujuan.',
      },
      {
        title: 'Aturan Pembatalan',
        body: 'Pembatalan sebelum pengemudi menerima pesanan bebas biaya (100% kembali). Setelah pengemudi menerima, dikenakan kompensasi Rp 2.000.',
      },
    ],
  },
  privasi: {
    title: 'Ketentuan Layanan & Privasi',
    items: [
      {
        title: 'Perlindungan Data Pengguna',
        body: 'Nomor handphone, riwayat lokasi pengiriman, dan foto bukti serah terima hanya digunakan untuk memproses pesanan antara pengirim dan pengemudi terkait.',
      },
      {
        title: 'Barang yang Dilarang',
        body: 'Pengirim dilarang menitipkan barang berbahaya, mudah meledak, zat terlarang, atau barang ilegal sesuai hukum Republik Indonesia.',
      },
    ],
  },
  kendaraan: {
    title: 'Kendaraan Terdaftar',
    items: [
      {
        title: 'Status Kendaraan Aktif',
        body: 'Kendaraan Anda digunakan untuk pencocokan kapasitas paket (XS hingga L tergantung jenis kendaraan) dan estimasi waktu tempuh di koridor Bali.',
      },
      {
        title: 'Pembaruan Data Kendaraan',
        body: 'Pastikan pelat nomor dan jenis kendaraan sesuai dengan kondisi fisik saat penjemputan agar pengirim mudah mengenali Anda.',
      },
    ],
  },
  'bantuan-driver': {
    title: 'Bantuan & Dukungan Driver',
    items: [
      {
        title: 'Mempublikasikan Rute Harian',
        body: 'Buka tab Rute Saya → Tambah untuk memasang rute perjalanan rutin Anda beserta batas simpangan (detour) maksimal yang Anda bersedia tempuh.',
      },
      {
        title: 'Alur Pengantaran Paket',
        body: 'Setelah menerima titipan, ketuk Mulai Perjalanan, konfirmasi saat paket dijemput, konfirmasi tiba di tujuan, lalu masukkan kode 4 digit dari penerima.',
      },
    ],
  },
  'syarat-driver': {
    title: 'Ketentuan & Syarat Driver',
    items: [
      {
        title: 'Tanggung Jawab Pengantaran',
        body: 'Pengemudi wajib menjaga keamanan paket selama perjalanan dan mengikuti instruksi penanganan khusus (mudah pecah / jaga dari air).',
      },
      {
        title: 'Komisi & Pendapatan',
        body: 'Seluruh ongkos titip driver menjadi hak pengemudi dan dicatat otomatis setelah verifikasi kode serah terima selesai.',
      },
    ],
  },
};

export default function InfoScreen() {
  const router = useRouter();
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const { user } = useAuth();

  const resolved = TOPICS[topic || 'bantuan'] || TOPICS.bantuan;
  const IconComp =
    topic === 'privasi' || topic === 'syarat-driver'
      ? FileText
      : topic === 'kendaraan'
        ? Bike
        : HelpCircle;

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar title={resolved.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card variant="flat" padding="lg" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.iconCircle}>
              <IconComp size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="headline" color={colors.text.primary} weight="700">
                {resolved.title}
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                {topic === 'kendaraan' && user?.vehicle
                  ? `${user.vehicle.type.toUpperCase()} • ${user.vehicle.plate}`
                  : 'Panduan resmi layanan Kirimin'}
              </Text>
            </View>
          </View>
        </Card>

        <Card variant="outlined" padding="lg" style={styles.listCard}>
          {resolved.items.map((item, idx) => (
            <View key={item.title}>
              {idx > 0 && <Divider style={{ marginVertical: spacing.md }} />}
              <View style={styles.itemHeader}>
                <ShieldCheck size={16} color={colors.primary} />
                <Text variant="calloutSemibold" color={colors.text.primary} style={{ marginLeft: 6 }}>
                  {item.title}
                </Text>
              </View>
              <Text variant="callout" color={colors.text.secondary} style={styles.itemBody}>
                {item.body}
              </Text>
            </View>
          ))}
        </Card>

        <Button
          label="Kembali"
          variant="primary"
          size="lg"
          onPress={() => router.back()}
          style={{ marginTop: spacing.lg }}
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
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    backgroundColor: colors.surface,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemBody: {
    lineHeight: 21,
  },
});
