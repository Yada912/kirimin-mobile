# Laporan Perubahan, Pembaruan UCD, & Analisis Teknis — Kirimin Mobile

Dokumen ini merangkum seluruh peningkatan yang diporting dari versi referensi (`kirimin-mobile-ver.-wisnu-main`), perombakan **User-Centered Design (UCD)** pada aplikasi utama (`app/`), verifikasi fungsi & peta, ringkasan **tech stack**, serta analisis kesiapan build **APK** untuk penggunaan mobile nyata.

---

## 1. Peningkatan yang Diporting dari Referensi Wisnu (`kirimin-mobile-ver.-wisnu-main`)

1. **Katalog Lokasi Koridor Bali (`app/src/constants/places.ts`)**
   - Mengintegrasikan 12 titik lokasi komuter Denpasar – Badung – Bukit (`Jl. Tukad Badung Renon`, `Renon`, `Panjer`, `Sesetan`, `Sanur`, `Simpang Dewa Ruci`, `Kuta`, `Bypass Nusa Dua`, `Jimbaran`, `Kampus Bukit Jimbaran`, `Gedung FT Kampus Bukit`, `Nusa Dua`) lengkap dengan alamat & area.
   - Menambahkan helper `haversineKm`, `describeCoordinates` (pelabelan otomatis titik peta terdekat), dan `interpolateAlongRoute` untuk simulasi GPS realistis.

2. **Modal Pemilihan Lokasi & GPS (`app/src/ui/PlacePickerSheet.tsx`)**
   - Bottom sheet interaktif dengan pencarian teks, filter area (`Semua`, `Denpasar`, `Badung`, `Bukit`), serta tombol **Gunakan Lokasi GPS Saat Ini** (`expo-location`) dengan penjagaan koordinat koridor Bali.

3. **Pembaruan Pembayaran Digital Interaktif (`app/src/ui/QrCodeMatrix.tsx` & `app/app/bayar/[orderId].tsx`)**
   - **QRIS Generator Deterministik (`QrCodeMatrix`)**: Merender matriks QR 25×25 dengan finder pattern standar langsung di SVG tanpa dependensi native tambahan.
   - **Dompet Digital (E-Wallet)**: Pilihan `GoPay`, `ShopeePay`, `DANA`, `OVO`, kode pembayaran otomatis, tombol **Salin**, serta tombol **Buka Aplikasi** via deep-link (`Linking.openURL`).
   - **Virtual Account Bank**: Pilihan `BCA`, `Mandiri`, `BNI`, `BRI` dengan nomor VA dan tombol **Salin**.
   - **Pelacak Status Pembayaran**: Indikator status *Lunas / Belum Dibayar*, status *Menunggu Konfirmasi* saat kembali dari aplikasi eksternal, serta opsi **Bayar Nanti**.

4. **Simulasi Pergerakan GPS Driver di Sepanjang Rute (`app/app/angkut/jalan/[tripId].tsx`)**
   - Mengganti koordinat acak (`Math.random()`) menjadi interpolasi bertahap sepanjang `[origin, ...stops, destination]` setiap 8 detik dan menampilkannya langsung di peta driver maupun pengirim.

5. **Pembuatan Rute Driver yang Lebih Lengkap (`app/app/angkut/buat-rute.tsx`)**
   - Mendukung pemilihan titik asal/tujuan dari seluruh 12 lokasi Bali atau tunjuk langsung di peta, pemilihan multi titik singgah (*stops*), serta chip waktu berangkat cepat (`07:30`, `08:00`, `12:00`, `17:00`).

---

## 2. Perombakan User-Centered Design (UCD) & Perbaikan UI/UX

### A. Perbaikan Peta, Pengaturan Peta, & Penunjukan Titik (`app/src/ui/MapView.tsx`)
- **Perbaikan Polyline Rute**: Garis rute biru putus-putus kini hanya menghubungkan `[pickup, ...stops, dropoff]` (sebelumnya lokasi driver ikut tersambung garis dari titik antar).
- **Update Live Tanpa Berkedip**: Perubahan marker atau lokasi driver disuntikkan melalui bridge `injectJavaScript` / `postMessage` sehingga peta Leaflet tidak melakukan reload ulang setiap beberapa detik.
- **Pengaturan Peta yang Berfungsi Penuh (`showSettings`)**:
  - **Pengalih Lapisan Peta (`Layers`)**: Pengguna dapat memilih `Peta Jalan (OSM)`, `Peta Ringan (Carto)`, atau `Peta Vektor Offline`.
  - **Tombol Pusatkan Rute (`Crosshair`)** dan **Zoom (`+` / `-`)**.
  - **Mode Tunjuk Langsung di Peta (`selectionMode`)**: Pengguna dapat mengaktifkan *Tunjuk Jemput* / *Tunjuk Antar* (atau *Tunjuk Asal* / *Tunjuk Tujuan*) lalu mengetuk area mana saja di peta (baik pada mode Leaflet maupun Vektor Offline) untuk memindahkan pin dan melihat koordinat + nama area terdekat secara langsung.
- **Fallback Otomatis Offline**: Jika tile OpenStreetMap / Leaflet gagal dimuat, peta otomatis beralih ke **Peta Vektor Bali Selatan** berbasis `react-native-svg` lengkap dengan pil mengambang *Jemput* / *Antar* dan badge jarak.

### B. Prinsip UCD pada Seluruh Alur Layar
- **Menghapus Kode Wireframe Developer**: Menghapus seluruh kode internal seperti `(S1)`, `(S2)`, `(S3)`, `(S4)`, `(S6)`, `(S7)`, `(D1-D2)`, `(D3)`, `(D4)`, `(X2)`, `(X3)`, `(P1)` dari judul layar dan label tombol sehingga bahasa antarmuka sepenuhnya natural bagi pengguna akhir.
- **Perbaikan Bug Preset Rute Beranda → Rute (`app/app/kirim/rute.tsx`)**: Memperbaiki bug di mana `pickupPreset` dan `dropoffPreset` dari beranda sebelumnya diabaikan. Kini preset langsung terisi otomatis, ditambah tombol **Tukar (Swap)** antara titik jemput dan antar.
- **Alur Pembayaran Terhubung (`app/app/kirim/konfirmasi.tsx` & `app/app/kirim/lacak/[id].tsx`)**: Jika pengirim memilih metode non-tunai (`QRIS`, `E-Wallet`, `Virtual Account`), aplikasi langsung mengarahkan ke layar pembayaran interaktif. Di halaman lacak pesanan, tagihan yang belum lunas menampilkan tombol **Bayar Sekarang**.
- **Perbaikan Layout Header (`app/src/ui/TopBar.tsx`)**: Mengubah `width` tetap pada slot aksi kanan menjadi `minWidth` agar tombol teks seperti `Chat` dan `Perjalanan` tidak terpotong.
- **Perbaikan Dependensi & Type Safety**: Menambahkan `react-native-svg` yang sebelumnya belum terpasang (yang menyebabkan error TypeScript pada ikon `lucide-react-native` dan berpotensi crash di runtime Android/iOS).

---

## 3. Verifikasi Fungsi & Pengujian

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| TypeScript App | `cd app && npm run typecheck` | Lulus (0 error) |
| Contract & Integration Tests App | `cd app && npm run test:contract` | Lulus (14/14 test) |
| Server Unit & API Tests | `cd server && npm test` | Lulus (32/32 test) |
| Audit Kode Wireframe UI | Scan `([SDXP]\d)` di `app/app/**/*.tsx` | 0 sisa di UI |

---

## 4. Ringkasan Tech Stack & Cara Menjalankan Sistem

| Lapisan | Teknologi | Peran |
|---|---|---|
| **Mobile App (`app/`)** | Expo SDK 58, React Native 0.88, React 19, Expo Router, TypeScript | Aplikasi lintas platform (Android/iOS/Web) dengan file-based routing |
| **State & Jaringan** | TanStack React Query v5, Fetch client, `react-native-sse`, `expo-secure-store` | Caching data API, pembaruan status realtime (SSE), penyimpanan token aman |
| **Peta & Lokasi** | `react-native-webview` (Leaflet + OSM/Carto), `react-native-svg` (Vector fallback), `expo-location` | Peta interaktif, pengaturan layer, tap-to-pin, dan pelacakan lokasi |
| **Backend API (`server/`)** | Node.js 22, TypeScript, HTTP server + SSE, SQLite (`node:sqlite`) | REST API, autentikasi token, matching rute & detour, upload foto, push/SSE |
| **Domain Bersama (`shared/`)** | TypeScript (`@kirimin/shared`) | Kontrak tipe API, enum status, label Bahasa Indonesia, aturan bisnis |

### Cara Menjalankan
1. **Backend Server**:
   ```bash
   cd server
   npm run dev
   ```
   Server berjalan di `http://localhost:3000` (dari Android Emulator diakses otomatis lewat `http://10.0.2.2:3000`).
2. **Aplikasi Mobile (Expo)**:
   ```bash
   cd app
   npx expo start
   ```
   Tekan `a` untuk membuka di Android Emulator atau scan QR menggunakan Expo Go.

---

## 5. Analisis Jika Dibuild Menjadi APK untuk Penggunaan Mobile Nyata

Mengubah aplikasi Expo ini menjadi file **`.apk`** (melalui **EAS Build** `eas build -p android --profile preview` atau `npx expo run:android --variant release`) sangat layak dilakukan, namun ada beberapa hal penting untuk penggunaan nyata di perangkat fisik:

1. **Kelebihan Build APK Standalone**:
   - Pengguna tidak perlu menginstal *Expo Go*, splash screen & ikon aplikasi tampil native, dan performa JS (Hermes) jauh lebih cepat dibanding mode development.
   - Deep-link aplikasi pembayaran (`GoPay`, `DANA`, `OVO`, `ShopeePay`), kamera (`expo-image-picker`), dan GPS (`expo-location`) bekerja lebih konsisten dengan `AndroidManifest.xml` yang terkonfigurasi penuh.

2. **Hal yang Wajib Disesuaikan Sebelum Rilis APK ke Pengguna**:
   - **Alamat Backend (`EXPO_PUBLIC_API_URL`)**: Saat ini default Android mengarah ke `http://10.0.2.2:3000` (khusus emulator). Untuk APK di HP nyata, backend harus di-deploy ke server publik HTTPS (misalnya VPS/Cloud Run/Railway) dan `EXPO_PUBLIC_API_URL` diarahkan ke domain tersebut, atau mengaktifkan `usesCleartextTraffic` hanya untuk jaringan lokal tertentu.
   - **Peta & Geocoding**: Saat ini `MapView` sudah tangguh (OSM + Carto + Vector offline fallback). Untuk skala produksi tinggi, pertimbangkan tile server komersial atau Mapbox/Google Maps SDK agar tidak terkena rate-limit tile publik OpenStreetMap, serta integrasi geocoding API untuk pencarian alamat jalan yang lebih detail di luar 12 preset Bali.
   - **Pembayaran Nyata**: Layar pembayaran saat ini adalah simulasi UX lengkap (QRIS/E-Wallet/VA). Untuk transaksi uang asli, perlu dihubungkan ke payment gateway (seperti Midtrans / Xendit) di `server/` untuk membuat *Snap/QR string* dinamis dan webhook verifikasi otomatis.
   - **Notifikasi Push**: Di APK standalone, `expo-notifications` memerlukan konfigurasi **Firebase Cloud Messaging (FCM)** (`google-services.json`) agar notifikasi tetap masuk saat aplikasi ditutup.

---

## 6. UCD Iterasi 2 — Peta Navigasi Jalan Nyata, Kustomisasi Penuh, & Loop Pengujian Visual

### A. Peningkatan Peta & Navigasi Driver (Terinspirasi Apple Maps, Google Maps, Gojek & Uber)
1. **Rute Jalan Nyata (`app/src/utils/routing.ts`)**:
   - Mengganti garis lurus putus-putus dengan rute jalan nyata melalui OSRM (*Open Source Routing Machine*) lengkap dengan fallback otomatis **Graf Jalan Arteri Bali Selatan** (Jl. Tukad Badung, Jl. Raya Sesetan, Jl. Bypass Ngurah Rai, Simpang Dewa Ruci, Jl. Raya Uluwatu, Jimbaran, Kampus Bukit, Nusa Dua).
   - Mendukung pemisahan segmen rute yang sudah dilalui (abu-abu lembut) dan sisa rute di depan (biru navigasi dengan tepi putih), bearing arah panah driver, serta perhitungan ETA & jarak sisa secara live.
2. **HUD Navigasi Interaktif (`app/src/ui/MapView.tsx`)**:
   - Banner panduan belokan (*turn-by-turn*) bergaya Apple/Google Maps di atas peta lengkap dengan drawer **Panduan Rute Jalan** (ketuk langkah mana saja untuk memfokuskan peta ke persimpangan tersebut).
   - 4 tema peta bebas API key: *Peta Bersih (Nav)*, *Peta Jalan Detail (OSM)*, *Mode Malam (Driver)*, dan *Vektor Offline*.
   - Mode layar penuh (*Fullscreen Map*), kartu info cepat saat pin diketuk, dan auto-follow driver yang otomatis jeda ketika pengguna menggeser peta.
3. **Layout Map-First & Thumb-Reach**:
   - Layar Perjalanan Aktif Driver (`app/app/angkut/jalan/[tripId].tsx`) dan Lacak Pesanan (`app/app/kirim/lacak/[id].tsx`) menampilkan peta navigasi besar di bagian atas dan tombol aksi utama langsung di jangkauan ibu jari tanpa perlu menggulir.

### B. Tampilan Lebih Berwarna, Ilustrasi Vektor, Kustomisasi, & Onboarding 3 Langkah
- **Identitas Warna Peran**: Biru Kobalt (`#1463F3`) untuk mode **Kirim** dan Hijau Zamrud (`#059669`) untuk mode **Angkut (Driver)**.
- **Ilustrasi Vektor Kustom (`app/src/ui/Illustrations.tsx`)**: Banner skuter komuter Bali, ilustrasi peta rute driver, hero selamat datang, dan perisai serah terima 4 digit.
- **Kustomisasi Penuh**:
  - **Kelola Preset Rute (`app/app/kelola/preset.tsx`)**: Tambah, edit, beri warna, hapus, dan gunakan preset rute cepat 1-ketuk (tersimpan permanen di `/me/settings`).
  - **Lokasi Tersimpan (`app/app/kelola/lokasi.tsx`)**: Kelola alamat Rumah/Kantor/Kampus/Lainnya dengan tunjuk pin langsung di peta (`/me/places`), langsung muncul di bagian atas `PlacePickerSheet`.
  - **Edit Profil, Kendaraan & Notifikasi (`app/app/kelola/profil.tsx`)** dan **Edit Rute Driver (`app/app/angkut/edit-rute/[tripId].tsx`)**.
- **Onboarding Pengguna Baru 3 Langkah (`app/app/(auth)/register.tsx`)**: Data akun + indikator kekuatan sandi → Pilihan peran & kendaraan driver → Pin lokasi favorit pertama di peta.

### C. Temuan & Perbaikan dari Loop Pengujian Visual (Playwright Mobile `390×844`)
Selama pengujian end-to-end visual pada 5 alur utama, ditemukan dan langsung diperbaiki 4 isu UX nyata:
1. **Watermark API Key Tile Carto**: Endpoint tile publik Carto menampilkan teks `API KEY REQUIRED`. Diperbaiki dengan tile OSM gratis + filter CSS khusus untuk *Peta Bersih* dan *Mode Malam (Driver)*.
2. **Pemotongan Label Bottom Tab Bar**: Label tab bawah terpotong di viewport mobile web (`height: 60`). Diperbaiki menjadi `height: 74` dengan `paddingBottom: 14`.
3. **Kepadatan Kontrol pada Mini-Map**: Tombol zoom `-` hampir terpotong pada peta setinggi 180px. Diperbaiki dengan menyembunyikan tombol `+/-` pada mini-map dan menampilkannya pada peta besar/layar penuh.
4. **Overflow `StatusPill` pada Kartu Lacak**: Label status panjang menekan sisi kanan kartu. Diperbaiki dengan `flex: 1` dan `numberOfLines={1}` pada kolom alamat kiri.

### D. Video Demo Alur Aplikasi (`docs/demos/`)
1. `docs/demos/01_onboarding_new_user.mp4` — Registrasi 3 langkah pengguna baru & setup kendaraan/lokasi favorit
2. `docs/demos/02_sender_kirim_flow.mp4` — Alur pengirim lengkap (Beranda → Paket → Peta Rute & Place Picker → Driver → QRIS → Lacak Live)
3. `docs/demos/03_driver_angkut_navigation.mp4` — Alur driver (Permintaan → Navigasi Jalan Live, Panduan Belokan, Mode Malam, Konfirmasi Jemput)
4. `docs/demos/04_handover_and_rating.mp4` — Serah terima kode rahasia 4 digit → Selesai perjalanan → Penilaian 5 bintang
5. `docs/demos/05_customization_and_editing.mp4` — Kustomisasi preset rute, lokasi peta tersimpan, edit profil/kendaraan, & edit rute driver

