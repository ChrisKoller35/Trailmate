# TrailMate

TrailMate ist eine Schweizer Wander-App. Ihr Kern ist das **Finden von Wanderpartnern** über offene Touren: Man schreibt eine Tour aus, andere fragen an, die Gruppe wandert gemeinsam. Karte, Routing, ÖV, Wetter, GPS-Aufzeichnung, Feed, Social und Gamification sind die Bausteine, die eine gefundene Gruppe in der App halten.

Geplanter Launch ist der 1. März 2027 im Schweizer App Store und bei Google Play, mit den Startregionen Zürich und Bern.

## Technik

- **App:** React Native mit Expo (Development Builds, EAS), expo-router, TypeScript strict
- **Zustand und Daten:** TanStack Query, Zustand
- **Karte:** MapLibre React Native
- **Backend:** Supabase (Postgres mit PostGIS und pgRouting, Auth, Realtime, Edge Functions)
- **Medien und Offline-Tiles:** Cloudflare R2

## Ordner

| Ordner | Inhalt |
|---|---|
| `app/` | Screens (expo-router) |
| `components/<bereich>/` | UI-Komponenten |
| `hooks/` | React-Hooks |
| `lib/` | Services (Supabase, Routing, Wetter usw.) |
| `stores/` | Zustand-Stores |
| `supabase/migrations/` | Datenbank-Migrationen (`NNN_kurzname.sql`) |
| `supabase/functions/` | Edge Functions |
| `__tests__/` | Jest-Tests |

## Lokal starten

Voraussetzungen: Node.js (LTS), npm, ein Supabase-Projekt (oder lokales Supabase über die Supabase CLI) und für Geräte-Builds ein Expo-Konto mit EAS CLI.

```bash
npm install
cp .env.example .env      # Supabase-URL, Anon-Key und R2-URL eintragen
npm start                 # Expo Dev Server
```

Weil die App native Module nutzt (u. a. MapLibre), läuft sie nicht in Expo Go, sondern nur in einem **Development Build**:

```bash
eas build --profile development --platform android   # bzw. --platform ios
```

Den Build auf dem Gerät oder Emulator installieren und mit `npm start` verbinden. Alternativ `npm run android` bzw. `npm run ios`.

Checks:

```bash
npm run lint
npx tsc --noEmit
npm test
```

## Wo die Pläne liegen

- [`docs/ROADMAP.md`](docs/ROADMAP.md) – Meilensteine und Reihenfolge bis zum Launch
- [`docs/spec/`](docs/spec/) – Spezifikation (00 Masterplan, 01–09 Bau-Dokumente; 09 ist der Kern: Wanderpartner-Matching)
- [`docs/ist-soll/`](docs/ist-soll/) – Abgleich Spezifikation gegen Code, mit offenen Aufgaben
- [`docs/ideen/backlog.md`](docs/ideen/backlog.md) – Ideen und offene Fragen
- [`docs/reflexion/`](docs/reflexion/) – Reflexions- und Produktklausuren

## Mitarbeiten

Arbeitsregeln (Branches, Definition of Done, Datenbank, Sicherheit) stehen in [`AGENTS.md`](AGENTS.md). Dazu gehören [`PLATFORM_CONVENTIONS.md`](PLATFORM_CONVENTIONS.md) und [`DEPENDENCIES.md`](DEPENDENCIES.md).
