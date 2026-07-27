# Farsi Daily App Store visual assets

This folder is the visual handoff for the iOS wrapper.

## Ready for Xcode

`Assets.xcassets` contains:

- `AppIcon.appiconset/AppIcon-1024.png` — the full-bleed, opaque 1024×1024 source icon. Current Xcode versions can generate iOS icon variations from this one source.
- `LaunchMark.imageset` — transparent 1×, 2×, and 3× launch marks.
- `LaunchBackground.colorset` — the light launch background (`#F7F7FC`).

Copy the three asset sets into the iOS project's existing `Assets.xcassets`, or replace that catalog with this prepared catalog after checking for other project assets.

## Launch screen configuration

Use the included `LaunchScreen.plist-snippet.xml` as the source for the target's `UILaunchScreen` dictionary:

- `UIColorName`: `LaunchBackground`
- `UIImageName`: `LaunchMark`
- `UIImageRespectsSafeAreaInsets`: `true`

The launch screen is intentionally simple and static. Use the actual Xcode simulator to verify its final alignment.

## App Store files

- `Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` is both the Xcode source and the 1024×1024 marketing icon source.
- `asset-manifest.json` records dimensions, modes, hashes, and brand colors for every generated PNG.

The app icon is RGB and contains no alpha channel. Do not add rounded corners; iOS applies the platform mask.

## Web/PWA files

Matching web icons live under `assets/icons`:

- `farsi-daily-192.png`
- `farsi-daily-512.png`
- `farsi-daily-maskable-512.png`
- `apple-touch-icon-180.png`

`manifest.json` points to the PWA icons. The service worker caches them for offline installation.

## Brand tokens

| Use | Value |
| --- | --- |
| Primary purple | `#5B4BDB` |
| Deep purple | `#4638BD` |
| Launch background | `#F7F7FC` |
| Accent mint | `#61C7A8` |

## Before App Store submission

1. Confirm the 1024 icon at actual Home Screen sizes in the simulator.
2. Confirm the launch mark is centered and does not jump when the first web view frame appears.
3. Capture real in-app screenshots from the final Xcode build. Do not use the launch preview as a product screenshot.
4. Run `node tests/app-store-assets.test.cjs` after changing any icon or asset-catalog file.
