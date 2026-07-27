# Capacitor iOS bootstrap

This folder contains the native runtime boundary for Farsi Daily. The generated `ios/` project is intentionally not included in this step.

## First iOS project creation

1. Install the pinned packages: `npm install`
2. Generate the native web bundle and Xcode project: `npm run cap:add:ios`
3. Open the workspace: `npm run cap:open:ios`

`cap:add:ios` performs three operations in order:

- Builds `dist/` from the existing static app.
- Bundles `native/native-bridge.ts` and gates normal app startup until Preferences hydration finishes.
- Creates the Capacitor iOS project, then applies the prepared icon, launch screen, and privacy-manifest files.

## Ongoing workflow

- After changing web code: `npm run cap:sync:ios`
- Open Xcode: `npm run cap:open:ios`
- Build and run from the CLI: `npm run cap:run:ios`

The generated Xcode project should be committed in the next step after it has been created and inspected on a Mac with the current Xcode toolchain.

## Native adapters

The bridge registers:

- Capacitor Preferences as the authoritative `farsi-*` learning-data store.
- Local Notifications for one repeating daily reminder.
- Haptics for impact and success/warning/error feedback.
- Share for the native iOS share sheet.

If native initialization fails, the existing browser storage and web behavior still start so the app does not remain on a blank screen.

## Bundle identifier

The prepared identifier is `com.farsidaily.app`. Change it in `capacitor.config.ts` before the first App Store record is created if a different identifier is required. Once the App Store record exists, treat the identifier as permanent.
