# Ist-Soll-Listen: Spezifikation gegen Code

*Erstellt am 12.10.2026 aus dem Code-Stand in `Trailmate start\TrailMate` (ungesichert, nur „Initial commit“). Jede Liste prüft die Akzeptanzkriterien eines Spezifikationsdokuments gegen den Code, mit Datei-Belegen, und endet mit Aufgaben für Agents samt Bestanden-Kriterium. Agents lesen vor ihrer Aufgabe immer das Spec-Dokument und die zugehörige Liste (siehe [AGENTS.md](../AGENTS.md)).*

## Überblick

Zählung der Statusmarken in den Akzeptanztabellen (✅ gebaut, 🟡 teilweise, ❌ fehlt, ↔️ weicht ab). Die Änderungen aus Anhang A von Dokument 09 sind überall als „fehlt“ gezählt.

| Dok. | Thema | ✅ | 🟡 | ❌ | ↔️ | Wichtigste Lücke |
|---|---|---|---|---|---|---|
| [01](01.md) | Fundament | 7 | 4 | 1 | 1 | Medien in Supabase Storage statt R2; spätere Migrationen hebeln den Block-Filter aus; `users` gibt E-Mail und Push-Token preis |
| [02](02.md) | Auth, Onboarding, Profil | 16 | 11 | 4 | 0 | **„Dev-Vorschau“-Knopf im Login umgeht Login und Premium**; kein Screen für fremde Profile; Follow-Vorschläge nicht eingebunden |
| [03](03.md) | Karte, Routing | 13 | 6 | 5 | 3 | Raster statt Vektortiles; BRouter statt pgRouting; Demo-Daten als Rückfall; kein Wegnetz-Import |
| [04](04.md) | Aufzeichnung | 13 | 5 | 6 | 1 | Weitgehend nach Spec; Pausen fliessen nicht in Gehzeit; kein GPX-Upload; „Im Feed teilen“ ist Platzhalter |
| [05](05.md) | Feed, Medien | 11 | 7 | 8 | 2 | Kein R2, keine Validierung, **EXIF/GPS bleibt in Fotos**, Videokomprimierung ohne installiertes Paket |
| [06](06.md) | Social | 20 | 18 | 12 | 4 | **Mehrere RLS-Fehler** (Community-Beitritt ohne Genehmigung, Post-Nachrichten an jeden, Community-Events scheitern); Moderation nur im Client |
| [07](07.md) | Wetter, ÖV, Wegzustand | 13 | 9 | 0 | 3 | yr.no statt MeteoSwiss, falsche Quellenangabe; **Rechenfehler** in Interpolation und Höhenkorrektur; ÖV komplett |
| [08](08.md) | Gamification, Live-Tracking, Premium | 14 | 14 | 7 | 1 | **Client setzt `is_premium` selbst**; keine IAP-Bibliothek; Live-Tracking sendet nie Standorte; Push wird nie verschickt; nur 19 von 42 Abzeichen vergeben |
| [09](09.md) | Wanderpartner (Kern) | 1 | 10 | 13 | 0 | Rund 90 % neu; Fundamente (PostGIS, ÖV, Realtime, Blocks, Badges) tragen; 4 strukturelle Lücken vorher schliessen |

## Was das für die Roadmap heisst

1. **Phase 1 bekommt einen Sicherheits-Sprint, nicht nur den RLS-Fix.** Neben `users_update`/`users_select` sind dazugekommen: der Dev-Vorschau-Knopf, die Community-/Gruppen-Policies, `post_messages` ohne Empfängerprüfung, Auto-Hide ohne Unique-Reporter, `SECURITY DEFINER` ohne `search_path`, EXIF in Fotos. Alles in [01](01.md), [02](02.md), [05](05.md), [06](06.md), [08](08.md) mit Bestanden-Kriterium.
2. **Push-Versand ist ein eigener Strang.** Alle Dokumente erzeugen `notifications`-Zeilen, aber nichts verschickt sie. Dokument 09 hängt davon ab (Erinnerungen, Anfragen). Gehört in Phase 1/2, vor dem Kern.
3. **Live-Tracking ist eine Hülle.** Für Dok. 09 ist es die wichtigste Sicherheitsfunktion und muss in Phase 2 fertig gebaut werden (Standort-Updates, Empfängerseite, Rückkehrzeit).
4. **Vier strukturelle Vorarbeiten für den Kern** (aus [09](09.md)): `recordings.route_id` setzen, Push-Versand, View `public_profiles`, `trusted_contacts` als echte Nutzer-Referenzen.
5. **Zwei Rechenfehler im Wetter** ([07](07.md)) sind klein, aber sichtbar: die Interpolation liefert 0, die Höhenkorrektur zieht bei 2100 m 12.6 °C ab.

## Pflege

Wer ein Akzeptanzkriterium erfüllt, setzt es in der Liste auf ✅ im selben Pull Request. Die Listen werden bei jedem Kurs-Check neu gezählt.
