# Use the APK with the backend running on your PC

One APK works with any backend. You don't rebuild it to change servers. Open the app, tap the **server pill** on the Welcome or Masuk screen (or **Profil → Alamat server**), enter the address your PC prints, and tap **Simpan**. The app checks the address first and remembers it.

## 1. Start the backend for phones

From the repo root in PowerShell:

```powershell
.\scripts\start-backend-for-phones.ps1            # phones on the same Wi-Fi as the PC
.\scripts\start-backend-for-phones.ps1 -Tunnel    # phones on any network (mobile data, campus Wi-Fi…)
```

The script:

1. Opens TCP port 3000 in Windows Firewall. This needs an Administrator PowerShell the first time. Otherwise, click **Allow** when Windows asks about Node.js.
2. Prints the addresses to enter in the app:
   ```
   Same Wi-Fi: enter one of these in the app (Alamat server):
       http://192.168.1.23:3000
   Any network: enter this in the app (Alamat server):
       https://quiet-river-1234.trycloudflare.com
   ```
3. Starts the API on `0.0.0.0:3000`. Stop it with `Ctrl+C`.

On macOS/Linux, use `./scripts/start-backend-for-phones.sh [--tunnel]`.

### Which address to use

| Situation | Address | Notes |
|---|---|---|
| Phone and PC on the same Wi-Fi | `http://<PC IP>:3000` | Fastest. Typing just `192.168.1.23` also works; the app adds `http://` and `:3000`. |
| Phone on mobile data or a different Wi-Fi | `https://….trycloudflare.com` | Needs `-Tunnel`. Free, no account. The URL changes every time the tunnel restarts, so re-enter it. |
| Android emulator on the PC | leave empty (built-in default) | The app finds `10.0.2.2:3000` / `adb reverse` by itself. |

Campus and public Wi-Fi often block device-to-device traffic ("client isolation"). If the same-Wi-Fi address doesn't respond there, use the tunnel or a phone hotspot.

Install the tunnel tool once with `winget install Cloudflare.cloudflared`.

## 2. Build the APK (Android Studio already installed)

```powershell
cd app
npm install
npx expo prebuild -p android --clean     # generates app/android (git-ignored)
cd android
.\gradlew assembleRelease
```

The APK is `app/android/app/build/outputs/apk/release/app-release.apk`. Copy it to the phone and install it (allow "install unknown apps"). This release build includes the JavaScript, so it doesn't need Metro or a USB cable.

What makes a standalone APK able to talk to a PC:

- `expo-build-properties` → `android.usesCleartextTraffic: true` in `app.json`. Android blocks plain `http://` by default, so without it LAN addresses fail.
- The server address is read at runtime (`src/utils/config.ts`): saved address → `EXPO_PUBLIC_API_URL` → emulator default.
- The server listens on `0.0.0.0` and allows any origin (`server/src/config.ts`).

To bake in a default for a hosted backend instead, build with `EXPO_PUBLIC_API_URL=https://your-api npx expo prebuild …`. Users can still override it in the app.

## 3. Troubleshooting

| What the app says | Fix |
|---|---|
| "Tidak ada jawaban…" | Phone and PC aren't on the same network, the server isn't running, or the firewall blocks port 3000. Open `http://<PC IP>:3000/health` in the phone's browser to test. |
| "Tidak bisa terhubung…" | Wrong address, or `http://` was blocked. Rebuild the APK after pulling this change (cleartext setting). |
| "Alamat ini bukan server Kirimin" | Something else answered on that address. Check the port. |
| Logged out after changing server | Expected: accounts live on each server. Log in again (demo password `kirimin123`). |
