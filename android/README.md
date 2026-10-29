# DCC Portal — Android app

A small native Android app (Java, no third-party libraries) that opens the DCC Education Portal in a locked-down WebView. All sign-in, permissions and data stay on the server and are enforced exactly as on the website. The app adds a home-screen icon, downloads, printing and a few safety rules.

- **Package:** `com.damdeichristiancollege.portal`
- **Supports:** Android 8.0+ (API 26). Targets API 35.
- **Size:** about 40 KB.

## What it does

| Feature | Behaviour |
|---|---|
| First launch | Asks for the portal address (for example `https://portal.example.edu.in`), unless one was built in with `PORTAL_URL`. You can change it later: long-press the app icon › *Portal address*, or tap *Change portal address* on the offline screen. Changing it clears the old session's cookies. |
| Navigation | Only the configured portal origin opens inside the app. Other links (websites, `tel:`, `mailto:`) open in the browser or dialler. `javascript:`, `file:`, `intent:` and `content:` links are ignored. |
| Downloads | PDFs (marksheets, receipts, slips) and CSV/Excel exports go to **Downloads**, using the user's session. The session cookie is sent only to the portal origin. In-page CSV templates (`data:` links) are saved directly. |
| Uploads | Upload fields (student import, marks CSV, notice attachments) open the Android file picker. |
| Printing | The portal's *Print* buttons open Android printing, where you can also *Save as PDF*. |
| Offline / errors | Shows a "Can't reach the portal" screen with *Try again*. Certificate errors always stop the connection; there is no "proceed anyway". |
| Dark mode | Follows the phone's setting. The portal's dark theme is used automatically. |

## Security choices

- **Release builds use HTTPS only:** cleartext traffic is disabled and only system certificate authorities are trusted.
- **Debug builds allow plain HTTP, but only to private addresses** (`10.x`, `192.168.x`, `172.16–31.x`, `localhost`), so a development server can be tested. Release builds are also not debuggable.
- **The app stores no passwords and keeps no data of its own.** It does not run any portal logic.
- **No backups:** backup and device transfer of app data (cookies, settings) are disabled.
- **WebView settings:** no file or content access, no mixed content, Safe Browsing on, and no third-party cookies.
- **One JavaScript bridge, for printing only:** `window.DccAndroid.print`. It acts only while a portal page is shown.

## Build

The tools needed are:
- JDK 17+
- `aapt2`, `zipalign` and `apksigner`
- `dalvik-exchange` (the `dx` dexer)
- `curl`, `zip` and `unzip`

On Ubuntu or Debian:

```bash
sudo apt-get install -y openjdk-21-jdk-headless aapt zipalign apksigner dalvik-exchange zip unzip curl
```

The Android framework jar is downloaded once into `.cache/` and its checksum is checked. If you have an Android SDK, set `ANDROID_HOME` instead and its `platforms/android-35/android.jar` is used.

Build a debug APK for testing:

```bash
./build.sh debug
```

Run the unit tests (portal-address and origin rules):

```bash
./test.sh
```

Output goes to `build/dcc-portal-<version>-<debug|release>.apk`.

**Testing against the local dev server:** with the Android emulator, enter `http://10.0.2.2:3000`. On a phone on the same Wi-Fi, enter `http://<your-PC-LAN-IP>:3000` and start Next.js with `pnpm dev -H 0.0.0.0`. Both need a **debug** build.

## Release signing

Create the key once, then keep it safe. Every update must be signed with the same key:

```bash
./scripts/create-release-key.sh ~/secure/dcc-portal-release.jks
```

Build a signed release:

```bash
DCC_KEYSTORE=~/secure/dcc-portal-release.jks DCC_KEYSTORE_PASS='…' DCC_KEY_ALIAS=dcc-portal PORTAL_URL=https://portal.your-college.example VERSION_CODE=2 VERSION_NAME=1.0.1 ./build.sh release
```

- Increase `VERSION_CODE` for every release.
- `PORTAL_URL` is optional. Without it, users type the address on first launch.
- Never commit `*.jks` or `*.keystore` files. They are git-ignored.

## Distribution

- **Direct install (sideloading):** share the release APK, for example from the college website over HTTPS. Users allow "Install unknown apps" for their browser or file manager. Publish the certificate SHA-256, so the IT team can confirm a file is genuine with `apksigner verify --print-certs`.
- **Google Play:** Play requires an Android App Bundle (`.aab`) and Play App Signing. Build an AAB with Android Studio or Gradle from these same sources. `build.sh` produces APKs only.
- **Password-reset links** in emails open in the phone's browser, which is fine. To open them in the app instead, you would need Android App Links: an `assetlinks.json` on the portal domain plus a verified intent filter. That is not set up.

## Project layout

```
android/
  build.sh, test.sh                 build without Gradle; unit tests
  scripts/create-release-key.sh
  app/src/main/AndroidManifest.xml
  app/src/main/java/…/portal/
    MainActivity.java     WebView host, navigation rules, errors, file picker, printing
    SetupActivity.java    first-run portal address screen
    PortalUrl.java        address validation and same-origin checks (pure Java, unit-tested)
    PortalConfig.java     stored address / build-time default
    Downloader.java       DownloadManager + data: URL saving
    ExternalLinks.java    safe hand-off of non-portal links
    Insets.java           edge-to-edge layout (required on Android 15+)
  app/src/main/res/…      layouts, adaptive icon, themes (light/dark), network security config
  app/src/debug/res/…     debug-only network config (HTTP to private addresses)
  app/src/test/java/…     PortalUrlTest
```

## Limitations

- **The app needs the portal to be deployed on HTTPS.** It shows the live website and has no offline mode.
- **Not run on a phone or emulator yet.** It builds, the APKs are signed and verified, and the unit tests pass, but it has not been run on a real device or emulator in this environment. Test on a few phones before rolling it out, covering sign-in, a PDF download, an upload and printing.
- **No push notifications:** the portal's in-app notifications are shown when the app is opened.
- **No pull-to-refresh:** use *Try again* on the error screen, or move to another page.
