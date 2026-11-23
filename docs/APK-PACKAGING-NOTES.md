# Notes for packaging the next APK (v1.2.0)

For whoever builds the Android release (Antigravity or a person). `main` already has the version set: `app.json` → `version 1.2.0`, `versionCode 3`.

## Build steps

```powershell
cd app
npm ci                                   # new deps since v1.1.0: phosphor-react-native, expo-font,
                                         # @expo-google-fonts/plus-jakarta-sans, expo-build-properties
npx tsc --noEmit -p .                    # must print nothing
npm run test:contract                    # needs the backend running (cd server; npm start)
npx expo prebuild -p android --clean     # REQUIRED: regenerate android/ (see below)
cd android
.\gradlew assembleRelease
```

Output: `app/android/app/build/outputs/apk/release/app-release.apk`. Copy it to `releases/kirimin-v1.2.0.apk`. Don't commit the `android/` folder (it's git-ignored and regenerated each time).

## Things that will bite if skipped

1. **Run `prebuild --clean`.** `app.json` gained two config plugins: `expo-build-properties` (sets `usesCleartextTraffic`) and `expo-font`. An `android/` folder generated before them won't have cleartext HTTP enabled. The APK would then fail to reach `http://192.168.x.x:3000` on a real phone, and the in-app server check shows "Tidak bisa terhubung".
2. **Don't bake in a server address** (`EXPO_PUBLIC_API_URL`) unless the backend is hosted. Users set the PC's address in the app: the server pill on Welcome/Masuk, or Profil → Alamat server. Without the variable the APK falls back to the emulator address, which is the right default.
3. **Release build, not debug.** A debug APK loads JavaScript from Metro and is blank without a cable or dev server.
4. **Signing.** The Expo template signs release builds with the debug keystore. That's fine for installing on phones directly. To install v1.2.0 *over* v1.1.0 without uninstalling first, it must be signed with the **same keystore** as v1.1.0. If it isn't, Android refuses the update; uninstall the old app first. For the Play Store, use a real keystore (`docs/PRODUCTION-SETUP-FREE.md` §6).
5. **Don't build during a demo.** Gradle uses 3–6 GB RAM and maxes out the CPU for 10–30 minutes on the laptop that also runs the backend.

## Check on a real phone before handing it out

Use the backend on the PC (`.\scripts\start-backend-for-phones.ps1`) and two phones if you can.

- [ ] **Fonts and icons.** Text is Plus Jakarta Sans (rounded, geometric), not Roboto. Icons are two-tone, and the active tab's icon is filled.
- [ ] **Server pill.** On Welcome, enter the PC's `http://192.168.x.x:3000`. "Cek" shows "Terhubung (… ms)"; Simpan, then log in as Wayan / `kirimin123`.
- [ ] **Map on the Kirim → Rute step.** Tiles are the soft "Bersih" style (CARTO Voyager). While a finger is on the map, the page does not scroll:
  - one-finger drag pans the map;
  - pinch zooms;
  - a single tap moves the pin chosen in the "Ketuk peta: Jemput | Antar" switch;
  - dragging the A/B pins moves them.
  Repeat on Angkut → Pasang rute and on a tracking screen.
- [ ] **Full flow.** Wayan sends to Made → Made accepts, presses "Mulai perjalanan", picks up, arrives, enters the code Wayan sees → "Paket sudah diserahkan" → Wayan's tracking turns to Selesai live → rating.
- [ ] **Live tracking with demo data.** Log in as Ayu and open her "Di jalan" order: Putu's position shows on the map.
- [ ] **Small screen (≈360 dp wide).** No text runs off the edge on the home screens, the driver list, Kirimanku and Rute saya.
- [ ] **Offline.** With no internet the map falls back to the simple drawn map instead of a blank box. Leaflet and the tiles load from the internet.

## If something is off

- **Map is blank or shows the simple map with internet on:** the phone can't reach `unpkg.com` or `basemaps.cartocdn.com`. Try another network.
- **Map still scrolls the page instead of panning:** report which screen. `MapView`'s `onInteractionChange` pauses the parent `ScrollView` on touch; the Android `WebView` also has `nestedScrollEnabled`.
- **Crash on start mentioning a font:** `expo-font` isn't in the native build. Re-run `npm ci` and `prebuild --clean`.
