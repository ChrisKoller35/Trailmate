# Platform Conventions

This document describes how TrailMate handles platform-specific code.

---

## File-Naming Convention

React Native / Expo supports **platform-specific file extensions** that are resolved automatically by Metro bundler:

| Extension | Resolved on |
|-----------|-------------|
| `module.native.ts` | iOS + Android only |
| `module.web.ts` | Web only |
| `module.ts` | All platforms (fallback) |

When Metro resolves `import './module'` it checks for a platform-specific file first, then falls back to the generic version.

**Use this convention when** a module has fundamentally different implementations on native vs. web (e.g. mapping, background tasks, sensors).

---

## Existing Platform Stubs

Some native-only packages have no web equivalent. These are stubbed out via custom Metro resolver rules in `metro.config.js`:

### `lib/maplibre-web-stub.js`

- **Stubs:** `@maplibre/maplibre-react-native`
- **Why:** MapLibre RN is native-only and crashes Metro's web bundler.
- **Web behaviour:** `<MapView>` renders a grey placeholder box with the text "Karte (nur auf Gerät verfügbar)". All other exports (`Camera`, `ShapeSource`, `LineLayer`, etc.) are no-op React components that render their children or `null`.
- **Metro alias:** Applied in `metro.config.js` when `platform === 'web'`.

### `lib/task-manager-web-stub.js`

- **Stubs:** `expo-task-manager`
- **Why:** Background task registration via `TaskManager.defineTask` is native-only; calling it on web throws.
- **Web behaviour:** All exported functions are no-ops. `isTaskRegisteredAsync` / `isAvailableAsync` resolve to `false`.
- **Metro alias:** Applied in `metro.config.js` when `platform === 'web'`.

---

## Guidelines for New Platform-Specific Code

### When to use a stub file

Use a stub when:
- A package is native-only and has no web SDK.
- The feature is gracefully degraded on web (e.g. "not available in browser").
- The alternative would be large `Platform.OS === 'web'` branches scattered across the codebase.

### How to add a new stub

1. Create `lib/<package-name>-web-stub.js` (CJS `module.exports`).
2. Export all symbols the rest of the codebase imports, as no-ops or reasonable defaults.
3. Add a resolver entry in `metro.config.js`:
   ```js
   if (platform === 'web' && moduleName === '<package-name>') {
     return { type: 'sourceFile', filePath: path.resolve(__dirname, 'lib', '<package-name>-web-stub.js') };
   }
   ```
4. Document the stub in this file.

### When to use `.native.ts` / `.web.ts` files

Use the file extension convention (instead of a Metro stub) when:
- Both platforms have a working implementation but with different APIs.
- The implementations are in your own code (not a third-party package).

Example:
```
lib/locationService.native.ts  ← uses expo-location
lib/locationService.web.ts     ← uses browser Geolocation API
lib/locationService.ts         ← shared types / fallback
```

### Avoid `Platform.OS` checks in render logic

Prefer file-level separation over inline `Platform.OS === 'web'` checks in JSX. Inline checks make components harder to test and understand.

Exception: minor style differences (e.g. `Platform.select({ ios: ..., android: ... })`) are acceptable in `StyleSheet.create`.

---

## Web Build Status

The web target is currently a **best-effort** port. Core features (GPS recording, MapLibre map) are intentionally degraded. The primary deployment targets are iOS and Android.
