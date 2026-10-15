# TrailMate – Masterplan: 8 Implementierungs-Dokumente

> **So funktioniert es:** Jedes Dokument wird einzeln an den Coding-Agent übergeben. Wenn Dokument 1 fertig abgearbeitet ist, wird es entfernt und Dokument 2 hinzugefügt – und so weiter. Jedes Dokument ist in sich geschlossen und enthält alles was der Agent braucht um es durchzuarbeiten.

---

## Reihenfolge & Abhängigkeiten

```
┌─────────────────────────────────────────────────────────────────────┐
│  01 → 02 → 03 → 04 → 05 → 06 → 07 → 08                           │
│                                                                     │
│  01: Projekt-Setup, DB-Schema, Supabase  (Fundament für alles)     │
│  02: Auth, Onboarding, Nutzerprofil      (braucht DB aus 01)       │
│  03: Karten, Geodaten, Routing           (braucht Supabase aus 01) │
│  04: GPS-Tracking, Routenaufzeichnung    (braucht Karten aus 03)   │
│  05: Feed, Posts, Medien-Upload          (braucht Profil aus 02)   │
│  06: Social (Folgen, DMs, Gruppen)       (braucht Feed aus 05)     │
│  07: Wetter, ÖV, Trail Conditions       (braucht Routing aus 03)  │
│  08: Gamification, Stats, Live-Tracking  (braucht alles vorher)    │
│                                                                     │
│  09: Wanderpartner finden (KERN)         (braucht 01–04, nutzt 07/08)│
│  Empfohlene Reihenfolge: 01→02→03→04→09→07→05→06→08               │
└─────────────────────────────────────────────────────────────────────┘
```

## Dokument-Übersicht

| # | Dokument | Beschreibung | Priorität |
|---|---|---|---|
| 01 | `01_Projekt_Setup_und_Fundament.md` | Expo-Projekt, Projektstruktur, alle Dependencies, Supabase-Setup, komplettes DB-Schema, Cloudflare R2, Realtime-Abstraktion | 🔴 Fundament |
| 02 | `02_Auth_Onboarding_Profil.md` | Supabase Auth, Registrierung/Login, 5-Schritt Onboarding, Nutzerprofil (Titelbild, Bio, Kennzahlen, Highlight-Touren), Einstellungen, Private Profile | 🔴 Must-have |
| 03 | `03_Karten_Geodaten_Routing.md` | MapLibre-Integration, Swisstopo Tile-Server, Offline-Karten (Premium), pgRouting-Engine, Routendatenbank, Routenplanung-Screen, Höhenprofil, SAC-Filter | 🔴 Must-have |
| 04 | `04_GPS_Tracking_Routenaufzeichnung.md` | GPS Background-Tracking (iOS 3-API-Strategie), Kalman-Filter, Pausenerkennung, Live-Track-Anzeige, Tour-Zusammenfassung, GPX-Export, Aufzeichnungs-Historie | 🔴 Must-have |
| 05 | `05_Feed_Posts_Medien.md` | Sozialer Feed (Hauptfeed + Entdecken-Tab mit Score-Algorithmus), Post-Erstellung (Fotos, Videos, Text, Routen), Like/Kommentar/Melden, Video-Strategie Phase 1, Cloudflare R2 Upload, Bookmark/Speichern, Cold-Start Seed Content | 🔴 Must-have |
| 06 | `06_Social_Folgen_DMs_Gruppen.md` | Folgen-System, DMs (gegenseitiges Folgen), Post-Postfach, Gruppen (öffentlich/privat, Ränge, Events), Communities (verifiziert, B2B), Blockieren, Moderation (3-Stufen-System), Admin-Dashboard | 🔴/🟡 Must/Should |
| 07 | `07_Wetter_OeV_TrailConditions.md` | MeteoSwiss ETL-Pipeline, yr.no Integration, Wetter-UI (stündlich/täglich, Warnungen, eigene Icons), Höhenkorrektur, SBB ÖV-Integration, Trail Conditions Quick-Reports, Gamification-Verknüpfung | 🟡 Should-have |
| 08 | `08_Gamification_Stats_LiveTracking_Premium.md` | Abzeichen-System (alle Kategorien + Bedingungen), Challenges & Events, Jahres-/Saisonstatistiken, Heatmap, Jahresrückblick, Live-Tracking (Vertrauenspersonen), Push-Notifications (Strategie + Einstellungen), Pricing Free/Premium | 🟡/🟢 Should/Nice |
| 09 | `09_Wanderpartner_Matching.md` | **Kern der App:** Offene Touren ausschreiben/finden, Anfragen & Tour-Chat, Spontan-Modus mit automatischem Gruppen- und Routenvorschlag, Vertrauensprofil (bestätigtes Level, Tempo-Faktor, Zuverlässigkeit), Sicherheitsarchitektur, Bewertungen, Wanderstamm, Organisationen. Anhang A listet die nötigen Änderungen an 00–08. | 🔴 Kern |

## Wichtige Regeln für den Coding-Agent

1. **Immer nur EIN Dokument** dem Agent geben
2. **Alle Akzeptanzkriterien** im Dokument müssen erfüllt sein bevor es als "fertig" gilt
3. **Jedes Dokument enthält das DB-Schema** das es braucht – der Agent muss nicht in andere Dokumente schauen
4. **Offene Fragen** sind im jeweiligen Dokument mit Entscheidungsvorschlag dokumentiert – Agent soll den Vorschlag umsetzen
5. **Tech-Stack ist fix**: React Native + Expo, Supabase, MapLibre, Cloudflare R2, PostGIS

## Entschiedene offene Fragen (gelten für alle Dokumente)

| Frage | Entscheidung |
|---|---|
| Repost-Funktion | Nein. Stattdessen Bookmark/Speichern. |
| Blockierte Nutzer | Sehen gar nichts (Instagram-Modell). |
| Gruppen-Events im Kalender | Ja, In-App-Kalender mit Zu-/Absage. |
| Mehrere Vertrauenspersonen | Ja, bis zu 3. |
| Abzeichen Profil vs. eigene Seite | Kompakte Vitrine (6 Abzeichen) auf Profil, Tap öffnet vollständige Sammlung. |
| Web-Version | Nach Mobile-Launch, frühestens 3 Monate danach. |
| Bookmark-Button | Ja, für Posts und Routen. |
| Routenaufzeichnung Free | Unbegrenzt im Free-Tier. |
| Kern der App | Wanderpartner finden (Dokument 09). Startseite, Onboarding und Profil richten sich danach. |
| Live-Tracking bei Touren mit Neuen | Automatisch und kostenlos (Dokument 09). |
