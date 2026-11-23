# Panduan Setup Layanan Eksternal Gratis (Rp 0) untuk Produksi Kirimin

Aplikasi **Kirimin** sudah siap digunakan secara penuh, namun beberapa fitur skala publik (hosting internet, penyimpanan foto cloud, pembayaran uang asli, dan push notification saat aplikasi tertutup) memerlukan layanan eksternal. Seluruh daftar di bawah ini dapat Anda siapkan sendiri **100% gratis (tanpa biaya bulanan / tanpa kartu kredit)**.

---

## 1. Hosting Backend (`server/`) + Database Cloud Gratis

Saat ini backend berjalan lokal (`localhost:3000`). Agar HP fisik di luar jaringan Wi-Fi Anda bisa terhubung, backend perlu di-deploy ke internet.

### A. Database SQLite Cloud Gratis: **Turso**
Backend Kirimin (`server/src/db/libsql.ts`) **sudah mendukung Turso (libSQL)** secara bawaan!
1. Daftar akun gratis di **https://turso.tech** (paket *Starter* gratis: hingga 500 database, 9 GB storage).
2. Buat database baru bernama `kirimin-prod`, lalu salin **Database URL** (`libsql://...`) dan buat **Auth Token**.
3. Simpan dua nilai ini sebagai environment variable:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`

### B. Hosting Node.js Gratis: **Render** atau **Koyeb**
1. Daftar gratis di **https://render.com** (hubungkan ke repositori GitHub Anda).
2. Pilih **New → Web Service**, arahkan ke repo ini:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Tambahkan Environment Variables di dashboard Render:
   - `TURSO_DATABASE_URL` = *(dari Turso)*
   - `TURSO_AUTH_TOKEN` = *(dari Turso)*
   - `TOKEN_SECRET` = *(string acak panjang, misal hasil `openssl rand -hex 32`)*
   - `CLOUDINARY_URL` = *(dari langkah 2 di bawah)*
4. Setelah deploy selesai, Anda akan mendapat URL HTTPS publik, misalnya `https://kirimin-api.onrender.com`.

> **Hubungkan ke Aplikasi Android:** Set `EXPO_PUBLIC_API_URL=https://kirimin-api.onrender.com` sebelum membangun APK rilis.

---

## 2. Penyimpanan Foto Paket & Bukti Serah Terima Gratis: **Cloudinary**

Backend (`server/src/storage/files.ts`) **sudah terintegrasi dengan Cloudinary** secara bawaan! Jika `CLOUDINARY_URL` belum diisi, foto disimpan di disk lokal (yang akan terhapus saat container hosting restart).
1. Daftar akun gratis di **https://cloudinary.com** (paket *Free*: 25 kredit/bulan = ~25 GB bandwidth/storage).
2. Di Dashboard Cloudinary, salin **API Environment Variable** (`CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>`).
3. Tempelkan `CLOUDINARY_URL` ke environment variable backend Anda (Render/Koyeb). Selesai — upload foto paket, KTP, dan bukti serah terima otomatis tersimpan permanen di CDN Cloudinary!

---

## 3. Payment Gateway Uang Asli Tanpa Biaya Bulanan: **Midtrans / Xendit**

Saat ini layar pembayaran mendukung QRIS, E-Wallet, dan Virtual Account secara interaktif di aplikasi. Untuk memproses transaksi uang sungguhan:
1. Daftar gratis di **https://midtrans.com** (Sandbox gratis tanpa dokumen bisnis; untuk *Production* perorangan/UMKM cukup KTP & rekening bank, **biaya bulanan Rp 0**, hanya biaya admin per transaksi sukses).
2. Ambil **Server Key** & **Client Key** dari dashboard Midtrans.
3. Hubungkan endpoint `POST /orders/:id/pay` di `server/` ke Midtrans Core API / Snap API untuk menghasilkan string QRIS/VA dinamis, lalu buat endpoint webhook `POST /webhooks/midtrans` untuk mengubah `payment_status` menjadi `'paid'` otomatis saat pembayaran diterima.

---

## 4. Push Notification Android Gratis: **Firebase Cloud Messaging (FCM)**

Backend (`server/src/push/expo.ts`) sudah menyiapkan pengiriman notifikasi push.
1. Buka **https://console.firebase.google.com** dan buat project baru (paket *Spark* **100% gratis**).
2. Tambahkan aplikasi Android dengan package name: `com.kirimin.app`.
3. Unduh file **`google-services.json`** dan letakkan di folder `app/google-services.json`.
4. Tambahkan `"googleServicesFile": "./google-services.json"` di bagian `"android"` pada `app/app.json`.
5. Di Firebase Console → **Project Settings → Cloud Messaging**, aktifkan Cloud Messaging dan unggah Service Account JSON ke Expo dashboard (`eas credentials`) jika memakai EAS Build.

---

## 5. Pencarian Alamat & Geocoding Gratis Tanpa API Key

Peta interaktif Kirimin (`OpenStreetMap`, `CartoDB Light`, dan `Vector Fallback`) sudah 100% gratis tanpa API key. Jika Anda ingin menambahkan kolom pencarian alamat jalan bebas di Bali:
- Gunakan **Photon API (`https://photon.komoot.io/api/?q=...&lat=-8.73&lon=115.20`)** atau **Nominatim (`https://nominatim.openstreetmap.org/search`)** — keduanya gratis tanpa kartu kredit (cukup sertakan header `User-Agent: KiriminApp/1.0`).

---

## 6. Keystore Rilis APK Gratis (Untuk Distribusi / Play Store)

Untuk menandatangani APK produksi dengan kunci milik Anda sendiri (gratis, cukup jalankan sekali):
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore kirimin-release.keystore -alias kirimin -keyalg RSA -keysize 2048 -validity 10000
```
Simpan file `.keystore` dan kata sandinya dengan aman (jangan di-commit ke repository publik).
