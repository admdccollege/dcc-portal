# Android test build

`dcc-portal-1.0.0-debug.apk` is a **debug** build for testing only (built with `./build.sh debug`).

- Signed with the standard Android debug key, not the college's release key. Do not distribute it to students or staff.
- Allows plain HTTP to private network addresses (for testing against a development server).
- Android 8.0+ (API 26), package `com.damdeichristiancollege.portal`, version 1.0.0 (1).
- Not yet tested on a phone or emulator.

Check the file: `sha256sum -c dcc-portal-1.0.0-debug.apk.sha256`

For a production release, build a signed release APK as described in [../README.md](../README.md#release-signing).
