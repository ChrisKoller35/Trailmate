# AGENTS.md – Arbeitsregeln für Coding-Agents im TrailMate-Repo

*Entwurf vom 12.10.2026. Gehört in die Wurzel des Repos `TrailMate` (als `AGENTS.md` und, falls gewünscht, als `CLAUDE.md` verlinkt). Grundlage: [ROADMAP.md](docs/ROADMAP.md) Abschnitt 9.*

## Was TrailMate ist

Eine Schweizer Wander-App, deren Kern das **Finden von Wanderpartnern** über offene Touren ist (Dokument `docs/spec/09_Wanderpartner_Matching.md`). Karte, Routing, ÖV, Wetter, Aufzeichnung, Feed und Gamification (Dokumente 01–08) sind die Bausteine, die eine gefundene Gruppe in der App halten. Bei Zielkonflikten gewinnt, was eine gemeinsame Tour möglich, sicher oder angenehmer macht.

## Stack (fix, nicht diskutieren)

React Native mit Expo (Development Builds, EAS), expo-router, TypeScript strict, TanStack Query, Zustand, MapLibre React Native, Supabase (Postgres, PostGIS, pgRouting, Auth, Realtime, Edge Functions), Cloudflare R2 für Medien und Offline-Tiles.

## Bevor du anfängst

1. Lies das Spezifikationsdokument deiner Aufgabe unter `docs/spec/` und die zugehörige Ist-Soll-Liste unter `docs/ist-soll/`. Die Spec sagt, was gebaut wird; die Ist-Soll-Liste sagt, was davon schon existiert. **Baue nichts neu, was dort als „gebaut“ steht.**
2. Lies `PLATFORM_CONVENTIONS.md` und `DEPENDENCIES.md`.
3. Deine Aufgabe hat ein Bestanden-Kriterium (aus ROADMAP oder der Ist-Soll-Liste). Wenn es fehlt oder unklar ist, formuliere es zuerst selbst und schreibe es in den Pull Request.

## Branch und Pull Request

- Ein Branch pro Strang: `feat/<strang>-<kurzname>` (z. B. `feat/C3-offene-touren`), `fix/<kurzname>` für Fehler, `chore/<kurzname>` für Werkzeug.
- `main` ist immer lauffähig. Niemals direkt auf `main` pushen.
- Kleine, abgeschlossene Pull Requests (ein Thema, unter etwa 800 geänderte Zeilen). Lieber zwei PRs als einen grossen.
- PR-Beschreibung: Was sieht man vorher, was nachher, wie wurde es gebaut, wie wurde es geprüft, Screenshot bei sichtbaren Änderungen.

## Definition of Done

- [ ] CI grün: ESLint, `tsc --noEmit`, `jest`, Migrationstest gegen lokales Supabase
- [ ] Neue Tabellen haben RLS aktiviert, vollständige Policies und einen Test, der fremden Zugriff verbietet
- [ ] Statusfelder, die Geld oder Vertrauen betreffen (`is_premium`, `is_verified`, Bewertungen, Zuverlässigkeit), werden **nur serverseitig** gesetzt (RPC mit `security definer` oder Edge Function mit Service-Rolle), nie vom Client
- [ ] Private Felder (E-Mail, Telefon, Push-Token, genauer Wohnort) liegen nie in einer öffentlich lesbaren Tabelle oder View
- [ ] Alle Texte über i18n (`de` und `en`), keine festen Strings im Code
- [ ] Auf Android und iOS gebaut und mindestens einmal gestartet; Abweichungen zwischen Plattformen im PR genannt
- [ ] Keine Secrets im Repo; `.env.example` aktualisiert, wenn neue Variablen dazukommen
- [ ] Akzeptanzkriterien der Spec, die der PR erfüllt, im PR aufgezählt und in `docs/ist-soll/0X.md` auf ✅ gesetzt

## Datenbank

- Migrationen fortlaufend nummeriert unter `supabase/migrations/`, Format `NNN_kurzname.sql`. Pro Woche ändert nur ein Strang Migrationen; absprechen über den PR.
- Jede Migration ist idempotent, soweit möglich (`if not exists`), und hat ein Down-Skript als Kommentar, wenn sie Daten zerstört.
- Fremde Profile werden nur über die View `public_profiles` gelesen.
- Alle Statuswechsel mit Folgen für andere (Anfrage annehmen, Tour absagen, Bewertung abgeben) laufen über RPCs, nicht über direkte Updates.

## Code

- Komponenten unter `components/<bereich>/`, Hooks unter `hooks/`, Services unter `lib/`, Screens unter `app/` (expo-router).
- Gemeinsame Dateien (`app/(tabs)/_layout.tsx`, `constants/theme.ts`, `types/`) haben pro Phase einen Besitzer; Änderungen daran nur in dessen Strang oder nach Absprache.
- Keine neuen Abhängigkeiten ohne Eintrag in `DEPENDENCIES.md` mit Begründung. Keine Pakete, die Expo-Managed-Workflow verlassen, ohne ausdrücklichen Auftrag.
- Keine `any`, keine `@ts-ignore` ohne Kommentar mit Grund.
- Fehlerzustände und leere Zustände gehören zu jedem Screen.

## Sicherheit und Datenschutz

- Treffpunkte sind öffentliche Orte; die App zeigt nie genaue Wohnorte.
- EXIF-Daten werden beim Upload entfernt.
- Standort im Hintergrund nur während einer Aufzeichnung oder eines aktiven Live-Trackings, mit sichtbarem Hinweis.
- Melden und Blockieren sind von jedem Profil, jeder Tour und jedem Chat aus mit einem Tipp erreichbar.

## Was ein Agent nicht entscheidet

Preis, Premium-Grenzen, Launch-Regionen, Rechtstexte, Haltung zu Dating, Änderungen an der Spezifikation. Solche Punkte kommen als Frage in den PR oder nach `docs/ideen/backlog.md`.
