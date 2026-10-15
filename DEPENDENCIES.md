# Dependency Tracker

Tracks key library versions, known compatibility issues, and the update strategy for TrailMate.

---

## Core Versions

| Package | Version |
|---------|---------|
| `react` | 19.2.0 |
| `react-native` | 0.83.2 |
| `expo` | ~55.0.6 |
| `expo-router` | ~55.0.5 |
| `typescript` | ~5.9.2 |

## State & Data Fetching

| Package | Version |
|---------|---------|
| `@tanstack/react-query` | ^5.90.21 |
| `zustand` | ^5.0.11 |

## Navigation & UI

| Package | Version |
|---------|---------|
| `@react-navigation/native` | ^7.1.28 |
| `react-native-screens` | ~4.23.0 |
| `react-native-safe-area-context` | ~5.6.2 |
| `react-native-gesture-handler` | ~2.30.0 |
| `react-native-reanimated` | 4.2.1 |
| `react-native-svg` | 15.15.3 |

## Mapping

| Package | Version |
|---------|---------|
| `@maplibre/maplibre-react-native` | ^10.4.2 |
| `maplibre-gl` | ^5.20.1 |

## Expo Modules

| Package | Version |
|---------|---------|
| `expo-location` | ~55.1.2 |
| `expo-task-manager` | ~55.0.9 |
| `expo-sensors` | ~55.0.8 |
| `expo-av` | ^16.0.8 |
| `expo-image-picker` | ~55.0.12 |
| `expo-file-system` | ~55.0.10 |
| `expo-notifications` | ~55.0.12 |
| `expo-sharing` | ~55.0.11 |
| `expo-secure-store` | ~55.0.8 |

## Backend

| Package | Version |
|---------|---------|
| `@supabase/supabase-js` | ^2.99.1 |

## Web

| Package | Version |
|---------|---------|
| `react-dom` | 19.2.0 |
| `react-native-web` | ^0.21.0 |
| `@expo/metro-runtime` | ~55.0.6 |

---

## Known Compatibility Issues & Watch List

### Zustand v5 + Metro web bundler
- **Problem:** Zustand v5 ships ESM `.mjs` files that use `import.meta`, which crashes Metro's web bundler.
- **Workaround:** Custom Metro resolver in `metro.config.js` redirects `zustand` and `zustand/middleware` imports to their CJS equivalents on web.
- **Status:** Active workaround, monitor for upstream fix in Zustand or Metro.

### react-native-worklets (0.7.2)
- Required by `react-native-reanimated` 4.x.
- Must be kept in sync with the exact `react-native-reanimated` version.
- **Risk:** Breaking changes between worklets and reanimated versions can crash the JS runtime silently.

### @maplibre/maplibre-react-native (native-only)
- Has no web support. Web is handled via `lib/maplibre-web-stub.js`.
- Major version bumps often require Hermes/JSI compatibility testing.

### expo-location + Background Permissions
- Background location permissions on Android 12+ require the `ACCESS_BACKGROUND_LOCATION` permission to be declared separately.
- iOS requires `NSLocationAlwaysAndWhenInUseUsageDescription` in `app.json`.
- Test permission flows on both platforms after any `expo-location` upgrade.

### react-native-reanimated 4.x
- Reanimated 4 has a new architecture. If upgrading from 3.x, all `useAnimatedStyle` / `useSharedValue` APIs should still work but the internal threading model changed.

---

## Update Strategy

1. **Wait for Expo SDK stable releases.** Expo SDK versions pin all compatible Expo module versions. Never upgrade individual `expo-*` packages independently — always upgrade the SDK as a unit.

2. **Pin React Native to the SDK-compatible version.** The Expo SDK version determines the compatible RN version. Do not upgrade RN independently.

3. **React Query minor/patch:** Safe to upgrade within `^5.x`. Check the [TanStack Query changelog](https://github.com/TanStack/query/releases) for breaking changes before major bumps.

4. **Supabase JS:** Safe to upgrade within `^2.x`. Check for deprecations in Auth and Realtime APIs.

5. **Test on both iOS and Android** after any navigation, gesture, or animation library upgrade. These packages are deeply coupled to the RN renderer.

6. **Check `react-native-worklets` version** whenever upgrading `react-native-reanimated`.

7. **Do not use `expo upgrade` blindly** — always read the Expo SDK migration guide before upgrading SDK major versions.

---

## Checking for Outdated Packages

```bash
npx expo install --check    # flags packages incompatible with current Expo SDK
npm outdated                # shows all packages with newer versions available
```
