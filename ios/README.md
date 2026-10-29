# DCC Portal — iOS app (iPhone and iPad)

A native iOS app (Swift, UIKit and WKWebView, no third-party libraries) that opens the DCC Education Portal securely. It is the iOS counterpart of the Android app in `../android` and follows the same rules: sign-in, permissions and all data stay on the server and are enforced exactly as on the website.

- **Bundle ID:** `com.damdeichristiancollege.portal`
- **Requires:** iOS / iPadOS 15+

## What it does

| Feature | Behaviour |
|---|---|
| First launch | Asks for the portal address (for example `https://portal.example.edu.in`), unless one was built in with `PORTAL_URL`. You can change it later: long-press the app icon › *Portal address*, or tap *Change portal address* on the offline screen. Switching to a different portal clears cookies and cached data. |
| Navigation | Only the configured portal origin opens inside the app. Other links open in Safari, Mail or Phone. `javascript:`, `file:`, `data:` and custom-scheme links are never handed off. Swipe from the edge to go back. |
| Downloads | Marksheet, receipt and slip PDFs, CSV/Excel exports and in-page CSV templates download with the user's session. The share sheet then opens (*Save to Files*, *Print*, AirDrop, …). Temporary copies are deleted afterwards. |
| Uploads | Portal upload fields use the iOS picker (Files, Photos, or Camera after the user grants permission). |
| Printing | The portal's *Print* buttons open the iOS print sheet. |
| Offline / errors | Shows "Can't reach the portal" with *Try again*. Certificate errors always stop the connection. |
| Dark mode, Dynamic Type, iPad | Follows the system appearance. Native screens scale with the user's text size. Supports all orientations and iPad multitasking. |

## Security choices

- **HTTPS only:** App Transport Security is on. `NSAllowsLocalNetworking` exists only so **debug** builds can reach a development server; the app rejects `http://` addresses in release builds, and in debug builds accepts them only for private addresses (`10.x`, `192.168.x`, `172.16–31.x`, `localhost`, `*.local`).
- **No passwords or portal data stored by the app.** WebKit's own data store holds the session cookie, as Safari would.
- **One script bridge, for printing only.** It accepts messages only from the portal's main frame and origin.
- **Privacy manifest included:** `PrivacyInfo.xcprivacy` declares no tracking and no data collected by the app. It also declares UserDefaults use, which only stores the portal address.
- **Camera permission:** the app asks only when a user chooses "Take Photo" for an upload.

## Build

This needs a Mac with **Xcode 16 or newer** and [XcodeGen](https://github.com/yonaskolb/XcodeGen).

Install XcodeGen:

```bash
brew install xcodegen
```

Generate the Xcode project:

```bash
cd ios && xcodegen generate
```

Open it:

```bash
open DCCPortal.xcodeproj
```

In Xcode, select the **DCCPortal** target › *Signing & Capabilities*. Choose the college's Apple Developer team, then run on a simulator or a connected iPhone.

**Testing against the local dev server:** use a **Debug** build.
- In the iOS Simulator, enter `http://localhost:3000`.
- On an iPhone on the same Wi-Fi, enter `http://<your-Mac-LAN-IP>:3000` and start Next.js with `pnpm dev -H 0.0.0.0`.

**Unit tests:** run them in Xcode with ⌘U. Without Xcode, run them on macOS or Linux with Swift 5.9+:

```bash
cd ios && swift test
```

**Built-in address (optional):**

```bash
xcodebuild -project DCCPortal.xcodeproj -scheme DCCPortal -configuration Release PORTAL_URL=https://portal.your-college.example
```

You can also set `PORTAL_URL` in `project.yml`.

**Version numbers:** set `MARKETING_VERSION` (for example 1.0.1) and increase `CURRENT_PROJECT_VERSION` for every upload.

**Continuous integration:** `.github/workflows/mobile.yml` builds and tests the app on a GitHub macOS runner (unsigned) and builds the Android APK. Push the repository to GitHub to get a compile check on every change.

## Distribution

Distributing an iOS app requires an **Apple Developer Program** membership (paid yearly, enrolled as the college organisation) and a Mac to archive and upload (*Product › Archive › Distribute App*).

| Route | Suits |
|---|---|
| **TestFlight** | Pilot with staff and students: up to 10,000 testers by email or public link, and builds last 90 days. Good for a first rollout. |
| **App Store, public or unlisted** | Unlisted apps are reachable only by direct link, which suits a college app. |
| **Apple Business Manager custom app** | Private distribution to the college's own organisation. |

**App Review warning.** Apple's guideline 4.2 ("minimum functionality") can reject apps that mainly display a website. These things help:
- Downloads, printing, offline handling and quick actions are native.
- The app is for a defined institution with sign-in. Provide a **reviewer demo account** on a deployed demo portal in App Store Connect › *App Review Information*.
- An unlisted app or a custom app is often a better fit than a public listing.

If review still objects, native push notifications or offline attendance would be the next features to add.

**App Store Connect › App Privacy:** the app itself collects nothing, but **the portal does** (names, contact details, academic records, linked to the user's account, not used for tracking). Declare these based on the portal, and link the college's privacy policy.

## Project layout

```
ios/
  project.yml                 XcodeGen project (app + unit-test targets)
  Package.swift               lets `swift test` run the core tests without Xcode
  DCCPortal/
    Info.plist                ATS, scene, quick action, permission texts, PORTAL_URL
    Core/PortalURL.swift      address validation and same-origin checks (Foundation only)
    App/AppDelegate.swift, SceneDelegate.swift
    App/PortalConfig.swift    stored address / build-time default / clearing website data
    App/SetupViewController.swift   first-run address screen
    App/PortalViewController.swift  WKWebView host: navigation rules, downloads, printing, errors
    Resources/Assets.xcassets       app icon, logo, brand colours (light/dark)
    Resources/PrivacyInfo.xcprivacy
  DCCPortalTests/PortalURLTests.swift
```

## Verification status and limitations

- **Verified:** the address and origin rules were tested on Linux with Swift 6.1 (3 test groups, 33 cases, all passing). Every Swift file passes a syntax check.
- **Not yet verified:** the UIKit/WebKit code has **not been compiled or run**, because building iOS apps needs Xcode on macOS. Before distributing, do two things:
  1. Run the CI workflow or build in Xcode.
  2. Test on an iPhone and an iPad: sign-in, a PDF download, an export, an upload with camera and files, printing, the offline screen, and changing the address.
- **The app needs the portal deployed on HTTPS.** It has no offline mode.
- **No push notifications:** in-app notifications appear when the app is opened.
- **Password-reset email links open in Safari.** To open them in the app, you would need Universal Links: an `apple-app-site-association` file on the portal domain plus the Associated Domains capability.
