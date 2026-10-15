# TrailMate – Masterplan & Roadmap bis zum Launch (Frühling 2027)

*Stand: 11. Oktober 2026. Ersetzt die Phasen im Plan [„TrailMate: Stand und Plan für den Neustart“](https://claude.ai/code/artifact/027c0bd5-e764-4c92-a8d0-52df01307fd2) vom 10. Oktober und baut auf der Spezifikation `docs/spec/00–09`, den beiden Produkteinschätzungen unter `notes/` und dem geprüften Code-Stand auf. Die Spezifikation (00_MASTERPLAN.md und die Dokumente 01–09) bleibt das „Was“; dieses Dokument ist das „Wann, in welcher Reihenfolge und mit welchen Denkpausen“.*

---

## 0. Kurzfassung

**Ziel:** TrailMate ist am **Montag, 1. März 2027** öffentlich im App Store und bei Google Play, zuerst im Schweizer Store, mit den Startregionen Zürich und Bern. Spätester Ausweichtermin ist **Freitag, 19. März 2027**, also vor Frühlingsanfang und vor Ostern (28. März), dem ersten grossen Wanderwochenende.

**Warum das machbar ist:** Es gibt schon eine laufende App mit rund 23'000 Zeilen, 45 Screens und 7 Migrationen. Wir starten nicht bei null, sondern bei „Prototyp fertig, Kern fehlt“. Bis zum Launch bleiben **20 Wochen**.

**Was den Zeitplan wirklich bestimmt, ist nicht das Programmieren.** Mit mehreren parallelen Agents ist Code der kleinste Engpass. Die harten Grenzen sind:

1. **Google-Play-Testpflicht:** Ein neues privates Entwicklerkonto braucht einen geschlossenen Test mit mindestens 12 Testern über 14 Tage am Stück, bevor die App überhaupt in die Produktion darf. Danach prüft Google den Antrag nochmals.
2. **Store-Reviews:** Eine App, über die sich Fremde treffen, mit Standort im Hintergrund, Nutzerinhalten und Abo wird beim ersten Mal sehr wahrscheinlich mindestens einmal zurückgewiesen. Dafür planen wir drei Wochen Puffer ein.
3. **Echte Tests draussen:** GPS im Hintergrund und eine echte gemeinsame Tour mit Fremden lassen sich nicht im Simulator prüfen. Das braucht Wochenenden, und die sind im Winter kurz.
4. **Deine Zeit als Prüfer:** Agents liefern schneller, als ein Mensch prüfen kann. Darum setzt der Plan stark auf automatische Tests und klare Abnahmekriterien.
5. **Kaltstart:** Am Launch-Tag müssen in Zürich und Bern schon echte offene Touren stehen. Dafür muss die Arbeit mit Vereinen und Botschaftern **im November** beginnen, nicht im Februar.

**Die Meilensteine im Überblick:**

| # | Meilenstein | Datum | Woran man es erkennt |
|---|---|---|---|
| M0 | Gesichert | So 18.10.2026 | Code liegt in einem privaten GitHub-Repo, Apple- und Google-Konto beantragt |
| M1 | Grün und sicher | Fr 30.10.2026 | Supabase läuft, CI grün, RLS-Lücke geschlossen, Spezifikation bereinigt |
| M2 | Echte Daten | Fr 13.11.2026 | Vektorkarte offline, pgRouting, echte Routen, MeteoSwiss, ÖV, iPhone-Build |
| M3 | Durchstich Wanderpartner | Fr 27.11.2026 | Zwei echte Personen finden sich in der App und wandern zusammen |
| M4 | Funktionskomplett | Fr 18.12.2026 | Alle Akzeptanzkriterien von 01–09 erfüllt, Google-Testpflicht läuft |
| M5 | Beta-Freigabe | Mo 4.1.2027 | Geschlossene Beta auf iOS und Android |
| M6 | Release-Kandidat | Mo 8.2.2027 | Einreichung bei Apple und Google |
| M7 | **Launch** | **Mo 1.3.2027** | Öffentlich im Schweizer App Store und bei Google Play |
| M8 | Saisonstart | Ostern 28.3.2027 | v1.1 mit ersten Erweiterungen, jedes Wochenende Touren in beiden Regionen |

**Eingebaute Denkpausen:** Fünf Reflexions- und Ideenschritte (Abschnitt 6), dazu ein wöchentlicher Wochenblick und ein monatlicher Kurs-Check. So ist der Plan nicht nur auf Fertigstellung ausgerichtet, sondern bringt das Produkt bei jeder Pause ein Stück weiter.

---

## 1. Ausgangslage am 11. Oktober 2026

### Code (heute auf deinem PC geprüft)

- Ordner `C:\Users\chris\Documents\Trailmate start\TrailMate`, Expo SDK 55, React Native 0.83, MapLibre 10, Supabase JS 2.
- **Immer noch nur der „Initial commit“ vom 13. März**, 29 Einträge ungesichert, kein GitHub-Remote. Die Entscheidung vom 10. Oktober zum Sichern ist noch offen. Das ist weiterhin das grösste einzelne Risiko im ganzen Projekt.
- 7 Migrationen (001–007), 3 Edge Functions (`calculate-route`, `weather-etl`, `weather-proxy`).
- `eas.json` baut nur Android, ein iOS-Profil fehlt.
- **Fehlt komplett:** In-App-Käufe (keine Bibliothek installiert), Mehrsprachigkeit (kein i18n), Crash-Reporting, Analytics, Social Login. Weil es keinen Google-Login gibt, verlangt Apple auch kein „Sign in with Apple“. Wenn wir später Google-Login einbauen, muss Apple-Login mitkommen.
- In der Spezifikation (Dok. 08) steht `expo-in-app-purchases`. Dieses Paket ist veraltet; wir nehmen RevenueCat oder `react-native-iap`.

### Bekannte Abweichungen und Lücken (aus dem Neustart-Plan)

| Bereich | Heute | Ziel |
|---|---|---|
| Sicherheit | `users_update` erlaubt das Setzen von `is_premium` und `is_verified`, `users_select` gibt E-Mail und Push-Token preis | Private Felder auslagern, Statusfelder nur serverseitig |
| Karte | Raster-WMS | Swisstopo-Vektortiles, Offline-Pakete als PMTiles auf R2 |
| Routing | öffentliche BRouter-API, Demo-Daten als Rückfall | pgRouting auf dem Swisstopo-Wanderwegnetz, BRouter als Reserve |
| Wetter | yr.no | MeteoSwiss (Open Data) für die Schweiz, yr.no für DE/AT |
| Medien | Supabase Storage | Cloudflare R2, EXIF-Daten beim Upload entfernen |
| Tests | jest nicht installiert, 3 Typfehler | CI mit Lint, Typecheck, Unit- und E2E-Tests |

### Spezifikation

- Dokumente 01–08 beschreiben die App ohne Wanderpartner-Suche. Dokument 09 beschreibt den Kern, und sein **Anhang A** listet die Änderungen an 01–08, die noch nicht eingearbeitet sind.
- Die Dokumente sind als „von null bauen“-Anleitungen geschrieben. Jetzt existiert aber Code. Ein Agent braucht deshalb pro Dokument zusätzlich eine **Ist-Soll-Liste**: Was davon ist schon gebaut, was fehlt, was weicht ab. Das ist neu in diesem Plan (Phase 1).

### Produkt

- Kern: **Wanderpartner finden** über offene Touren (Dok. 09), Planung mit ÖV, Wetter und Wegzustand als das, was eine gefundene Gruppe in der App hält.
- 18 Ideen aus `notes/produkt-einschaetzung.md` und die Matching-Bausteine aus `notes/produkt-einschaetzung-wanderpartner.md` sind noch nicht einsortiert. Das passiert in Abschnitt 7.

---

## 2. Leitplanken für alle Entscheidungen

1. **Der Kern geht vor.** Wenn zwei Dinge um dieselbe Woche konkurrieren, gewinnt das, was eine gemeinsame Tour möglich, sicher oder angenehmer macht.
2. **Sicherheit ist nie Premium und nie „später“.** Verifizierung, Melden, Blockieren, Live-Tracking bei Touren mit Neuen und die Moderation sind Launch-Bedingung.
3. **Launch zuerst im Schweizer Store, mit Zürich und Bern als Matching-Regionen.** Die ganze Schweiz kann die App laden und Routen, Karte und Aufzeichnung nutzen. Das Matching ist regional freigeschaltet (Feature-Flag `matching_regions`, Dok. 09.18). DE und AT folgen, wenn der Schweizer Heimvorteil steht (siehe 11). Das spart beim Launch auch die EU-Pflichten für Händlerangaben im Store (DSA), die bei einem Abo-Angebot in EU-Stores sonst Name und Adresse öffentlich machen.
4. **Umfang wird nicht pauschal gekürzt, aber zeitlich sortiert.** Alles aus 01–09 ist für den Launch geplant. Neue Ideen kommen über die Ideenschritte in die richtige Version (1.0, 1.1, 1.2 …), statt den Launch zu verschieben.
5. **iOS von Anfang an mit.** Anders als im Neustart-Plan ist iOS keine späte Phase mehr. Hintergrund-GPS auf dem iPhone ist das technisch riskanteste Stück und muss ab November laufend getestet werden.
6. **Jede Phase endet mit einem prüfbaren Ergebnis**, nicht mit „ungefähr fertig“.

---

## 3. Zeitplan, rückwärts vom Launch geplant

### Feste äussere Grenzen

| Grenze | Was sie verlangt | Folge für den Plan |
|---|---|---|
| Frühlingsanfang 20.3.2027, Ostern 28.3.2027 | Die App muss vor dem ersten grossen Wanderwochenende draussen sein, mit Touren drin | Launch 1.3., Ausweichtermin 19.3. |
| Apple-Review | meist 1–2 Tage pro Runde, beim ersten Mal oft 1–3 Runden, bei Treffen-mit-Fremden-Apps eher mehr | Einreichung spätestens 8.2. = 3 Wochen Puffer |
| Google: geschlossener Test | ≥ 12 Tester, 14 Tage ununterbrochen eingetragen, danach Antrag auf Produktionszugang mit Prüfung | Geschlossener Test startet schon **Mo 14.12.2026** mit Freunden und Familie, damit die Frist unabhängig von der Beta-Qualität abläuft |
| Google: Standort im Hintergrund | eigene Deklaration in der Play Console mit Begründung und Demo-Video, wird separat geprüft | Video und Text bis M4 vorbereiten |
| Google: Ziel-API | neue Apps müssen seit 31.8.2026 Android 16 (API 36) als Ziel haben | Bei der Expo-Aktualisierung in Phase 1 prüfen |
| Apple Developer Program | Einzelperson in 1–2 Tagen, Firma braucht D-U-N-S-Nummer (bis 2 Wochen) | Sofort beantragen (W1) |
| Feiertage | Reviews und Tester sind zwischen 23.12. und 3.1. langsam | Diese Zeit für die Ideen-Werkstatt nutzen, keine Abgaben planen |
| Kaltstart | Am Launch-Tag braucht jede Region jedes Wochenende ≥ 3 offene Touren | Vereine und Botschafter ab November ansprechen |

### Rückwärtsrechnung

```
Mo  1.3.2027  LAUNCH (manuelle Freigabe nach Zulassung)
Fr 26.2.      Beide Stores zugelassen  ◄── 3 Wochen Puffer für Zurückweisungen
Mo  8.2.      Einreichung RC bei Apple und Google
Fr 29.1.      Funktionsstopp (nur noch Fehlerbehebungen)
Mo 18.1.      Regionale Beta Zürich/Bern startet, Google-Produktionszugang beantragt
Mo  4.1.      Geschlossene Beta (TestFlight extern + Play geschlossener Test)
Mo 14.12.     Play geschlossener Test mit ≥ 12 Personen läuft (14-Tage-Uhr startet)
Fr 18.12.     Funktionskomplett
Fr 27.11.     Durchstich: erste echte gemeinsame Tour über die App
Fr 13.11.     Echte Daten: Karte, Routing, Wetter, ÖV, iPhone-Build
Fr 30.10.     Grün und sicher
So 18.10.     Gesichert
```

### Gesamtbild nach Wochen

```
KW   42   43   44   45   46   47   48   49   50   51   52   53   01   02   03   04   05   06   07   08   09
     12.10     26.10      9.11      23.11      7.12      21.12       4.1       18.1       1.2       15.2  1.3
     ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
P0   ███                                                                          Sichern & Entscheiden
P1        ████                                                                    Fundament grün, Spec bereinigt
P2             █████████                                                          Abweichungen schliessen
P3                  ██████████████                                                Kern: Wanderpartner (Dok. 09)
P4                                 ████████████                                   Ausbau, Politur, iOS-Parität
P5                                                     ████████████               Beta
P6                                                                  ████████████  Store, Launch
GTM            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Vereine, Botschafter, Warteliste
R    K1                       R2                  R3             R4                       (R5 im April)
M    M0   M1        M2        M3             M4        M5        ·    M6             M7
```

---

## 4. Meilensteine mit Abnahmekriterien

Ein Meilenstein gilt erst als erreicht, wenn **alle** Punkte erfüllt sind. Sonst rutscht er sichtbar, und der nächste Kurs-Check entscheidet, was wir tun.

### M0 – Gesichert (So 18.10.2026)
- [ ] Gesamter Code committet (ohne `.env`), privates GitHub-Repo `TrailMate` angelegt und gepusht
- [ ] Dokumente 00–09 und diese Roadmap liegen im Repo unter `docs/`
- [ ] Apple Developer Program beantragt (Entscheid: als Einzelperson oder Firma)
- [ ] Google-Play-Entwicklerkonto beantragt (Identitätsprüfung dauert einige Tage)
- [ ] Supabase-Projekt fortgesetzt oder aus Backup neu aufgesetzt
- [ ] Name „TrailMate“ in beiden Stores und als Marke (Swissreg) geprüft, Domain gesichert
- [ ] Produkt-Klausur K1 durchgeführt (siehe 6)

### M1 – Grün und sicher (Fr 30.10.2026)
- [ ] RLS-Lücke geschlossen, mit Test, der beweist, dass ein normales Konto `is_premium` nicht setzen und keine fremde E-Mail lesen kann
- [ ] `jest` läuft, Typecheck ohne Fehler, CI auf GitHub (Lint, Typecheck, Tests, Migrationstest gegen lokales Supabase)
- [ ] Expo auf die aktuelle SDK-Version gehoben, Ziel-API 36 bestätigt
- [ ] Lokale Entwicklung mit `supabase start`, Staging-Projekt in der Cloud
- [ ] iOS-Profil in `eas.json`, erster Development Build auf einem iPhone
- [ ] Anhang A von Dok. 09 in die Dokumente 01–08 eingearbeitet
- [ ] Ist-Soll-Liste pro Dokument 01–09 (Abschnitt 5, Phase 1)

### M2 – Echte Daten (Fr 13.11.2026)
- [ ] Karte mit Swisstopo-Vektortiles, Offline-Paket einer Region auf echtem Gerät im Flugmodus nutzbar (Android und iPhone)
- [ ] Routenplanung über pgRouting mit Höhenprofil und offizieller Wanderzeit; keine Demo-Daten mehr
- [ ] Routendatenbank mit echten Routen für mindestens die Regionen Zürich, Bern, Berner Oberland, Zentralschweiz
- [ ] MeteoSwiss-Prognose am Start- und Zielpunkt, mit Höhenkorrektur
- [ ] ÖV-Verbindung zum Start und vom Ziel inklusive letzter Rückfahrt
- [ ] Erster GPS-Feldtest auf beiden Plattformen (Bericht mit Akkuverbrauch, Pausenerkennung, Genauigkeit)

### M3 – Durchstich Wanderpartner (Fr 27.11.2026)
- [ ] Konto A schreibt eine offene Tour aus (Route, Datum, Treffpunkt Bahnhof, Plätze, Tempo)
- [ ] Konto B findet sie über die Startseite „Touren“, sieht Passung, Wetter, Wegzustand und ÖV
- [ ] B fragt an, A nimmt an, Tour-Chat öffnet sich
- [ ] Check-in am Treffpunkt, automatisches Live-Tracking an eine Vertrauensperson, gemeinsame Aufzeichnung
- [ ] Gegenseitige Bewertung danach, Vertrauensprofil aktualisiert (Level, Tempo-Faktor, Zuverlässigkeit)
- [ ] **Das Ganze einmal draussen mit einer echten zweiten Person gemacht**, nicht nur am Schreibtisch

### M4 – Funktionskomplett (Fr 18.12.2026)
- [ ] Alle Akzeptanzkriterien von 01–09 erfüllt oder bewusst in eine spätere Version verschoben (Liste im Repo)
- [ ] In-App-Käufe auf beiden Plattformen in der Sandbox getestet
- [ ] App auf Deutsch und Englisch
- [ ] Crash-Reporting und Analytics-Events aus Dok. 09.18 aktiv
- [ ] Konto-Löschung in der App und über eine Webseite
- [ ] Play geschlossener Test mit ≥ 12 eingetragenen Personen läuft seit 14.12.

### M5 – Beta-Freigabe (Mo 4.1.2027)
- [ ] TestFlight-Beta-Review bestanden, externe Tester eingeladen
- [ ] Datenschutzerklärung, Nutzungsbedingungen, Community-Richtlinien und Impressum online und in der App verlinkt
- [ ] Moderations-Queue und Admin-Dashboard im Einsatz, Bereitschaft geregelt
- [ ] Feedback-Kanal für Tester (in der App und als Gruppe)

### M6 – Release-Kandidat (Mo 8.2.2027)
- [ ] Keine offenen Fehler der Stufe „blockierend“ oder „hoch“
- [ ] Store-Einträge vollständig: Texte DE/EN, Screenshots, Datenschutz-Angaben (Apple) und Datensicherheit (Google), Altersfreigabe, Hintergrund-Standort-Deklaration mit Video, Prüfnotizen mit Testkonto
- [ ] Google-Produktionszugang erteilt
- [ ] In Zürich und Bern stehen für jedes Wochenende im März je ≥ 3 offene Touren

### M7 – Launch (Mo 1.3.2027)
- [ ] Beide Stores zugelassen, manuell freigegeben
- [ ] Landingpage, Warteliste angeschrieben, Vereine und Botschafter informiert
- [ ] Supabase Pro mit täglichen Backups, Monitoring und Alarme aktiv

### M8 – Saisonstart (Ostern, 28.3.2027)
- [ ] v1.1 draussen (siehe 11)
- [ ] Kennzahlen aus Dok. 09.18 werden wöchentlich ausgewertet

---

## 5. Phasen im Detail

Die Phasen überlappen bewusst. Innerhalb jeder Phase laufen mehrere Agents parallel, jeder auf einem eigenen Branch mit einem klaren Bestanden-Kriterium. „A1, A2 …“ bezeichnet je einen parallelen Arbeitsstrang.

### Phase 0 – Sichern und Entscheiden (KW 42, 12.–18.10.)

**Ziel:** Nichts kann mehr verloren gehen, und die grossen Produktentscheide sind getroffen.

- [ ] Code committen und als privates Repo sichern (braucht dein Ja, die Frage aus dem Thread vom 10.10. ist noch offen)
- [ ] Supabase fortsetzen (nur du kannst das im Dashboard)
- [ ] Apple- und Google-Konto beantragen, Testgeräte klären
- [ ] Namens- und Markenprüfung „TrailMate“
- [ ] **Produkt-Klausur K1** (Abschnitt 6): Launch-Umfang, Preis, Regionen, Store-Land, Ideen-Einsortierung
- [ ] Repo-Grundlagen für Agents: `AGENTS.md` bzw. `CLAUDE.md` mit Konventionen, Branch-Regeln, Definition of Done (Abschnitt 9)

### Phase 1 – Fundament grün, Spezifikation bereinigt (KW 43–44, 19.–30.10.)

**Ziel:** Auf einer sicheren, getesteten Basis kann parallel gebaut werden.

| Strang | Aufgabe | Bestanden, wenn |
|---|---|---|
| A1 Sicherheit | RLS-Lücke schliessen: private Felder (`email`, `push_token`, Telefonnummer) in `user_private`, `is_premium` und `is_verified` nur per Service-Rolle; View `public_profiles` (Dok. 09 Anhang A); alle Policies aus 002 und 09.2 prüfen | pgTAP- oder jest-Tests gegen lokales Supabase grün |
| A2 Werkzeug | jest + jest-expo, Typfehler, ESLint, CI-Workflow, Maestro für E2E | CI grün auf `main` |
| A3 Aktualisierung | Expo-SDK-Update, `expo-av` ersetzen, Ziel-API 36, iOS-Profil in `eas.json` | Dev-Build auf Android und iPhone startet |
| A4 Spezifikation | Anhang A von 09 in 01–08 einarbeiten; 00_MASTERPLAN aktualisieren | Kein Widerspruch zwischen 01–09 mehr |
| A5 Ist-Soll | Pro Dokument 01–09 eine Liste: Akzeptanzkriterium → gebaut / teilweise / fehlt / weicht ab (mit Datei) | `docs/ist-soll/0X.md` für alle 9 Dokumente |
| A6 Infrastruktur | Cloudflare-R2-Bucket, Staging-Supabase, Sentry, Analytics (EU-Hosting) | Zugänge dokumentiert, Secrets nicht im Repo |

**A5 ist erledigt (12.10.2026):** Die Ist-Soll-Listen liegen unter [docs/ist-soll/](ist-soll/README.md). Ergebnis: Dokumente 01–08 sind zu etwa 55 % gebaut, 30 % teilweise, der Rest fehlt oder weicht ab; Dokument 09 ist zu 90 % neu. Die Listen haben **Phase 1 erweitert**:

| Strang | Zusatz aus den Ist-Soll-Listen | Quelle |
|---|---|---|
| A1 Sicherheit | Dev-Vorschau-Knopf im Login entfernen; Community- und Gruppen-Policies (Beitritt ohne Genehmigung, Events scheitern); `post_messages` prüft Empfänger nicht; Auto-Hide ohne Unique-Reporter; `SECURITY DEFINER` ohne `search_path`; Block-Filter in 003/007 wiederherstellen; Rate-Limits als DB-Trigger | 01, 02, 06, 08 |
| A7 Push-Versand (neu) | Edge Function, die `notifications` per Expo-Push verschickt, mit Präferenz-Prüfung; `pg_cron` für Erinnerungen. Alle Dokumente erzeugen Zeilen, nichts verschickt sie; Dok. 09 hängt davon ab | 07, 08, 09 |
| A8 Vorarbeiten Kern (neu) | `recordings.route_id` beim Speichern setzen; View `public_profiles`; `trusted_contacts` als Nutzer-Referenzen statt `{name, phone}`; `users` an `auth.users` koppeln | 09, 01 |
| B6 GPS (Phase 2) | Pausen in Gehzeit einrechnen; GPX nach R2; Live-Tracking fertig bauen (Standort-Updates, Empfängerseite `/track/`, Rückkehrzeit-Alarm), weil es für Dok. 09 die wichtigste Sicherheitsfunktion ist | 04, 08 |
| B4 Wetter (Phase 2) | Zwei Rechenfehler (Interpolation liefert 0; Höhenkorrektur mit Stationshöhe 0) vor dem ETL-Umbau fixen | 07 |

### Phase 2 – Abweichungen schliessen (KW 44–47, 26.10.–20.11.)

**Ziel:** Alles, was die App draussen braucht, läuft mit echten Daten.

| Strang | Aufgabe | Bestanden, wenn |
|---|---|---|
| B1 Karte | Vektortiles von Swisstopo, Offline-Pakete als PMTiles aus dem offiziellen MBTiles-Download, selbst auf R2 gehostet | Region offline im Flugmodus auf beiden Plattformen |
| B2 Routing | Wanderwegnetz in PostGIS, pgRouting mit Wanderzeit nach Wegweiser-Formel, BRouter als Reserve | Route Bern–Gurten und Kandersteg–Oeschinensee korrekt |
| B3 Routen-DB | Echte Routen importieren (eigene Kuratierung + offene Daten), Schwierigkeit nach SAC-Skala | ≥ 300 Routen in den Startregionen |
| B4 Wetter | MeteoSwiss-Open-Data-ETL, yr.no für DE/AT, Unwetterwarnungen | Prognose und Warnung an einer Route sichtbar |
| B5 ÖV | Verbindungen, nächste Haltestelle, letzte Rückfahrt, Reisezeit-Matrix für das Matching (09.5), Echtzeit für Erinnerungen | Treffpunkt Bern HB → Start → Ziel → zurück korrekt |
| B6 GPS | Feldtests iOS und Android, Kalman, Pausen, Akku; Bahn- und Seilbahnabschnitte erkennen (für den Tempo-Faktor) | Feldbericht mit Messwerten von ≥ 3 Touren |
| B7 Medien | Upload auf R2, EXIF entfernen, Bildgrössen | Foto ohne GPS-Metadaten im Bucket |

Für B3 ist zu klären, woher die Routenbeschreibungen kommen dürfen. Die Wegdaten von Swisstopo sind offen, fremde Tourenbeschreibungen (z. B. von SchweizMobil) aber nicht automatisch. Das gehört in K1.

### Phase 3 – Kern: Wanderpartner (KW 45–49, 2.11.–4.12.)

**Ziel:** Dokument 09 ist vollständig gebaut. Beginnt, sobald A1 (Sicherheit) fertig ist, und läuft parallel zu Phase 2.

| Strang | Aufgabe (Abschnitt in Dok. 09) |
|---|---|
| C1 Datenmodell | Migration 9.2 mit allen Tabellen, Triggern und vollständiger RLS, Tests pro Policy |
| C2 Vertrauensprofil | Bestätigtes Level, Tempo-Faktor, Wanderstil, Zuverlässigkeit (9.3); Edge Function `refresh-hiking-profile` |
| C3 Offene Touren | Erstellen (9.4), Startseite „Touren“ mit Passungs-Score und Filter (9.5), Tourdetail |
| C4 Teilnahme | Anfragen, Warteliste, Zusage, Erinnerungen, Check-in, Abschluss (9.6), Tour-Chat (9.7) |
| C5 Spontan-Modus | Signal, Matching-Job, Vorschlag mit Route und Treffpunkt (9.8) |
| C6 Sicherheit | 18+, Telefon-Verifizierung, öffentliche Treffpunkte, Auto-Live-Tracking gratis, Sicherheitsknopf, Meldegründe, Matching-Sperre (9.9) |
| C7 Danach | Bewertungen (9.10), „Nochmal zusammen?“, Wanderstamm (9.12), Mentoring (9.13) |
| C8 Organisationen | Organisationsprofile, Tourenleitende, CSV-Import (9.14), Fahrgemeinschaften (9.15) |
| C9 Umbau bestehender Teile | Neues Onboarding, Profil mit Abschnitt „Als Wanderpartner“, Touren als Start-Tab, Einstellungen „Wanderpartner“ (Anhang A, Dok. 02) |
| C10 Admin & Kennzahlen | Ampel pro Region und Wochenende, Botschafter, Seed-Touren, Analytics-Events (9.18) |

Telefon-Verifizierung braucht einen SMS-Anbieter (z. B. über Supabase Phone Auth mit Twilio). Das kostet pro SMS etwas und braucht ein Konto, das du anlegst.

### Phase 4 – Ausbau, Politur, iOS-Parität (KW 48–51, 23.11.–18.12.)

**Ziel:** Funktionskomplett nach 01–09 und so poliert, dass Fremde die App ohne Erklärung verstehen.

- [ ] Feed als zweiter Tab, Post-Typ „Gemeinsame Tour“, Entdecken mit offenen Touren (Dok. 05 + Anhang A)
- [ ] Social: Gruppen-Events als offene Tour, Gruppen aus „Nochmal zusammen?“ (Dok. 06 + Anhang A)
- [ ] Gamification mit den sozialen Abzeichen aus 9.16, Challenges, Statistiken, Jahresrückblick (Dok. 08)
- [ ] Push-Benachrichtigungen nach 9.11 und 08.5
- [ ] Premium: In-App-Käufe über RevenueCat (empfohlen) oder `react-native-iap`, Paywall, Testphase, Wiederherstellen
- [ ] Mehrsprachigkeit: i18n-Gerüst, Deutsch und Englisch vollständig (Englisch ist für Zugezogene zentral), Französisch vorbereitet
- [ ] Barrierefreiheit (Schriftgrössen, Screenreader-Labels, Kontrast)
- [ ] Leere Zustände, Fehlermeldungen, Offline-Verhalten, Ladezeiten
- [ ] iOS-Parität: alle Flows auf dem iPhone durchgetestet, Hintergrund-GPS über eine ganze Tour
- [ ] E2E-Tests (Maestro) für die fünf wichtigsten Abläufe: Registrieren, Tour ausschreiben, Anfragen und Zusagen, Aufzeichnen, Melden

### Phase 5 – Beta (4.1.–5.2.2027)

**Geschlossene Beta (4.–17.1.):** 20–40 Personen, die du kennst oder über Botschafter findest, auf iOS und Android. Fokus: Abstürze, Verständlichkeit, GPS, erste echte Wintertouren.

**Regionale Beta Zürich/Bern (ab 18.1.):** 100–300 Personen über die Warteliste, Vereine und Botschafter. Fokus: Finden sich wirklich Leute? Kommen Touren zustande? Funktioniert die Moderation?

- [ ] Wöchentlich ein Beta-Build, Änderungsnotizen für Tester
- [ ] Jede Woche mindestens 3 echte offene Touren pro Region (Winterwanderungen, Schneeschuh auf markierten Trails)
- [ ] Kennzahlen aus 09.18 messen: Durchführungsquote, Annahmequote, No-Show-Quote
- [ ] **Beta-Retro R4** (Abschnitt 6) in KW 03
- [ ] Funktionsstopp Fr 29.1.

Ehrlich gesagt: Eine Beta im Januar trifft die ruhigste Wanderzeit. Das ist kein Grund, sie zu verschieben, denn wir testen hier vor allem Technik und Abläufe. Die Kennzahlen aus der Beta sind aber tiefer, als sie im April sein werden, und dürfen nicht entmutigen.

### Phase 6 – Store und Launch (1.2.–1.3.2027)

- [ ] Release-Kandidat Mo 8.2. an Apple und Google
- [ ] Prüfnotizen mit Testkonto, Demo-Tour und Erklärung von Hintergrund-Standort, Nutzerinhalten und Moderation
- [ ] Zurückweisungen sofort bearbeiten (ein Agent auf Abruf)
- [ ] Offene Beta läuft weiter (TestFlight extern, Play offener Test)
- [ ] Launch-Material: Landingpage, Pressetext, Social-Media-Posts, Mail an Warteliste, Info an Vereine
- [ ] Mo 1.3. manuelle Freigabe, danach zwei Wochen „Hypercare“: tägliche Auswertung von Abstürzen, Meldungen und Kennzahlen

### Paralleler Strang: Go-to-Market und Kaltstart (ab KW 45)

Dieser Strang ist kein Code und darum nicht von Agents allein zu erledigen. Er entscheidet aber, ob die App am 1. März leer oder lebendig ist.

| Wann | Was |
|---|---|
| Nov | Landingpage mit Warteliste pro Region; Liste von 30 Ansprechpartnern (SAC-Sektionen Zürich/Bern, Naturfreunde, Pro Senectute, ASVZ, Uni-Sport Bern, Expat-Vereine, Wandergruppen auf Meetup und Facebook) |
| Nov–Dez | Erste Gespräche, Gratis-Grundpaket für Organisationen anbieten, CSV-Import zeigen |
| Dez | Botschafter-Programm: 10–15 Personen pro Region, die zu je 2 Touren pro Monat bereit sind |
| Jan | Organisationen und Botschafter in der Beta, erste Touren im März eingetragen |
| Feb | Launch-Kommunikation vorbereiten, lokale Medien und Wanderblogs ansprechen |

---

## 6. Reflexions- und Ideenschritte

Diese Schritte sind feste Termine im Plan, keine Kür. Jeder hat ein Ziel, Material, eine Agenda und ein schriftliches Ergebnis im Repo unter `docs/reflexion/`. Ich bereite jeden Schritt mit einer Vorlage vor, du entscheidest.

### Wiederkehrend

- **Wochenblick (jeden Sonntag, 30 Min):** Was ist fertig, was hängt, was braucht dein Ja? Was hast du beim Testen bemerkt? Ergebnis: Status in diesem Dokument aktualisiert.
- **Kurs-Check (Ende Oktober, November, Dezember, Januar, Februar):** Liegt der nächste Meilenstein noch im Plan? Wenn nicht, was verschieben wir, was machen wir parallel? Ein Satz pro Meilenstein.
- **Ideen-Eingang (laufend):** Jede neue Idee kommt in `docs/ideen/backlog.md`, mit einem Satz Problem, einem Satz Lösung, und wird erst im nächsten Ideenschritt bewertet. So stört sie die laufende Arbeit nicht und geht trotzdem nicht verloren.

### K1 – Produkt-Klausur (KW 42 oder 43, ca. 3 Stunden)

**Ziel:** Bevor gebaut wird, schauen wir das ganze Projekt noch einmal als Produkt an.

Material: beide Produkteinschätzungen, Dok. 09, Ideenliste aus Abschnitt 7.

1. **Positionierung in einem Satz.** Vorschlag: *„TrailMate bringt Menschen zusammen, die wandern wollen, und plant die Tour für alle gleich mit.“* Stimmt das für dich?
2. **Zielgruppen für den Launch.** Zugezogene und Expats, Leute ohne wandernde Freunde, Einsteiger, Frauen, die nicht allein gehen möchten. Fehlt jemand, ist jemand zu viel?
3. **Launch-Umfang bestätigen.** Alles aus 01–09; welche Ideen aus Abschnitt 7 kommen zusätzlich in v1.0?
4. **Preis.** Die Einschätzung empfiehlt CHF 4.90/Monat oder CHF 39/Jahr statt CHF 1.99. Finden und Mitkommen sowie Sicherheit bleiben gratis. Entscheiden: Preis, Testphase, gibt es ein Gründer-Angebot für die ersten Nutzer?
5. **Regionen und Store-Land:** Schweizer Store, Matching in Zürich und Bern. Bestätigen.
6. **Haltung zu Dating** (Dok. 09.9) bestätigen.
7. **Routeninhalte:** Woher kommen Beschreibungen und Bilder der Routen?
8. **Als Einzelperson oder Firma** im Store auftreten? Das bestimmt, welcher Name im Store steht.

Ergebnis: `docs/reflexion/K1-produkt-klausur.md` mit allen Entscheiden; Änderungen fliessen in 00_MASTERPLAN und die betroffenen Dokumente.

### R2 – Feature-Werkstatt: Bestehendes erweitern (KW 48, 23.–29.11., nach dem Durchstich)

**Ziel:** Mit der laufenden App in der Hand jede bestehende Funktion anschauen und fragen, wie sie dem Kern besser dient. Das passt genau nach M3, weil man dann zum ersten Mal erlebt hat, wie sich eine gemeinsame Tour anfühlt.

Fragenkatalog pro Bereich, mit je einem Startimpuls von mir:

| Bereich | Leitfrage | Impuls |
|---|---|---|
| Karte | Hilft die Karte beim Finden von Leuten? | Layer „Offene Touren“ mit Treffpunkten; Heatmap „wo wird diese Woche gewandert“ |
| Routing | Kann die Route für eine Gruppe geplant werden statt für eine Person? | Treffpunkt-Optimierung: Bahnhof, den alle am schnellsten erreichen |
| Aufzeichnung | Was weiss die App nach einer gemeinsamen Tour, das sie nutzen könnte? | Gruppen-Aufzeichnung: ein Track für alle, geteiltes Album danach |
| Profil | Würde ich mit dieser Person auf Grund ihres Profils losgehen? | Gemeinsame Bekannte („Lena kennt Marco aus 3 Touren“) |
| Feed | Warum sollte jemand hier posten statt auf Instagram? | Tourenbericht mit Wegzustand als Hauptinhalt, Foto als Beilage |
| Gruppen | Entstehen Gruppen aus echten Touren? | Wanderstamm mit Rotation der Tourenleitung |
| Wetter/ÖV | Was nimmt der Gruppe Planungsarbeit ab? | Hinweis auf SBB-Gruppenbillett ab 10 Personen, Sparbillette für alle |
| Gamification | Belohnen Abzeichen das Verhalten, das die Community braucht? | Zuverlässigkeit und Mentoring stärker belohnen als Höhenmeter |
| Live-Tracking | Fühlt sich die Vertrauensperson sicher informiert? | Automatische Meldung „Gruppe ist zurück am Bahnhof“ |
| Premium | Würde ich dafür zahlen, und wofür genau? | Premium als Planungs-Werkzeug für Organisierende |

Ergebnis: `docs/reflexion/R2-feature-werkstatt.md`; jeder Vorschlag bekommt eine Version (1.0, 1.1, später) und wird, wenn 1.0, in Phase 4 eingeplant.

### R3 – Zwischen den Jahren: Vision und neue Ideen (28.12.2026–3.1.2027)

**Ziel:** Abstand gewinnen und über den Launch hinaus denken. Die Feiertage sind dafür ideal, weil Reviews und Tester ohnehin langsam sind.

1. Wie sieht TrailMate in einem Jahr aus, wenn alles gut läuft? Und in drei Jahren?
2. Durchgehen des Ideen-Backlogs und der Ideen aus Abschnitt 7: Was hat sich durch den Bau verändert?
3. **Ganz neue Richtungen**, bewusst ohne Machbarkeitsfilter. Beispiele zum Anstossen: Firmen-Wandertage als B2B-Angebot, Sprachtandem-Wanderungen für Zugezogene, „Erste-Tour-Garantie“ (jede neue Person bekommt eine Botschafterin für die erste Tour), Wanderungen mit Kinderbetreuung, Kooperation mit Hütten für Gruppenreservationen.
4. Geschäftsmodell nach dem Launch: Marktplatz für geführte Touren, Organisationen, Tourismus.
5. Roadmap nach dem Launch (Abschnitt 11) anpassen.

Ergebnis: `docs/reflexion/R3-vision.md` und eine aktualisierte Abschnitt 11.

### R4 – Beta-Retro (KW 03, 18.–24.1.2027)

**Ziel:** Ehrlich auswerten, was die geschlossene Beta zeigt, bevor der Funktionsstopp kommt.

1. Was hat Tester verwirrt? (Top 10, aus Feedback und Analytics)
2. Wo bricht der Ablauf vom Öffnen bis zur ersten gemeinsamen Tour ab?
3. Was haben Tester vermisst?
4. Entscheid pro Punkt: vor dem Launch beheben, in v1.1, oder bewusst nicht.

Ergebnis: `docs/reflexion/R4-beta-retro.md`, Aufgabenliste bis zum Funktionsstopp.

### R5 – Launch-Retro und Saisonplanung (Mitte April 2027)

**Ziel:** Nach den ersten Wochen draussen den Kurs für die Sommersaison setzen.

1. Kennzahlen aus 09.18 gegen die Ziele
2. Was sagen Bewertungen in den Stores und Meldungen in der Moderation?
3. Welche Region kommt als nächste (Basel, Luzern, St. Gallen, Romandie)?
4. Roadmap Sommer und Herbst 2027 festlegen

---

## 7. Ideen-Pipeline: Wohin gehört welche Idee?

Alle Ideen aus den beiden Produkteinschätzungen, eingeordnet nach meiner Empfehlung. In K1 bestätigst oder änderst du die Einordnung. Bewertet ist jeweils: Stärkt es den Kern (Wanderpartner)? Wie gross ist der Aufwand? Passt der Zeitpunkt zur Saison?

### Bereits im Kern (Dok. 09, Launch)

Offene Touren und Tourenbörse (Idee 9), Spontan-Modus, Vertrauensprofil mit Tempo-Faktor, Sicherheitsarchitektur, Frauen-Touren, Bewertungen, Wanderstamm, Mentoring, Organisationen, Fahrgemeinschaften.

### Empfehlung: zusätzlich in v1.0

| Idee | Warum jetzt | Aufwand |
|---|---|---|
| **GPX-Import früherer Touren** (aus Idee 14) | Das Vertrauensprofil braucht aufgezeichnete Touren. Ohne Import haben alle neuen Nutzer am Launch-Tag ein leeres Profil und kein bestätigtes Level. Import von GPX-Dateien (Strava, Komoot, Garmin exportieren GPX) füllt Level und Tempo ab Tag 1 | mittel |
| **Mutterkuh- und Herdenschutzhund-Meldungen** (Idee 6) | Nur eine weitere Kategorie bei den Wegzuständen, sehr nützlich, typisch schweizerisch | klein |
| **Familien- und Genussfilter** (Idee 10) | Öffnet die App für Familien und Gelegenheitswandernde; Filter auf vorhandene Routendaten | klein bis mittel, je nach Daten |
| **Letzte Rückfahrt in jeder Tour** (einfache Form von Idee 2) | „Letzte Verbindung ab Ziel 17:12“ in der Tourkarte. Die ÖV-Abfrage existiert schon | klein |

### v1.1 – Saisonstart (Ostern 2027)

| Idee | Warum dann |
|---|---|
| **Letzter-Bus-Wächter** unterwegs (Idee 2) | Braucht Feldtests mit Live-Tempo; ideal zum Start der Saison |
| **Notausgang** (Idee 3) | Baut auf ÖV und Routing auf; braucht Offline-Fahrplan |
| **Hütten als Inhaltslieferanten** (Idee 5), Pilot mit 5–10 Hütten | Hütten öffnen im Mai/Juni; Gespräche ab Februar |
| **„Wohin heute?“** (Idee 1) als Erweiterung des Spontan-Modus | Gemeinsam: „Wohin gehen wir am Samstag?“ für eine ganze Gruppe |

### v1.2 – Sommer 2027

| Idee | Warum dann |
|---|---|
| **Gewitter-Radar am Weg** und Umkehrzeit-Alarm (Idee 4) | Gewittersaison Juni bis August, starkes Premium-Argument |
| **Digitales Gipfelbuch** (Idee 8) | Hochsommer, viele Gipfel; schöne soziale Funktion |
| **Fortschrittspfad und Packliste** (Idee 17) | Passt zu Mentoring, Einsteiger steigern sich über den Sommer |
| **Natürliche Sprache für die Planung** (Idee 18) | Ergänzt „Wohin heute?“ |
| **Marktplatz für geführte Touren** (Dok. 09.14, Phase 2) | Braucht Zahlungsabwicklung, Verträge und Haftung; grösster Umsatzhebel |

### v1.3 – Herbst 2027

| Idee | Warum dann |
|---|---|
| **Nebelmeer-Finder** (Idee 1) | Inversionslagen Oktober bis Dezember |
| **Swisstopo-Zeitreise** (Idee 7) | Medienwirksam, gut für eine Herbstkampagne |
| **Besucherlenkung** (Idee 11) | Braucht eine Saison an Nutzungsdaten; B2B mit Regionen |

### v2.0 – Winter 2027/28 und später

| Idee | Warum dann |
|---|---|
| **Winter-Modus** (Idee 12): Winterwanderwege, Schneeschuh, Lawinenbulletin, Wildruhezonen | Macht die App ganzjährig, rechtfertigt das Jahresabo |
| **Mehrtagestouren und Hüttentouren** (Idee 13) | Grösseres Projekt mit Hütten-Partnerschaften |
| **Digitaler Wanderpass** mit Partner-Belohnungen (Idee 15) | Braucht Tourismus-Partner |
| **Sagen und Geschichten am Weg** (Idee 16) | Inhalte mit Regionen produzieren |
| **Web-Version** | Laut Masterplan frühestens 3 Monate nach Mobile-Launch |
| **DACH-Ausbau** | Erst wenn die Schweiz trägt; mit DB/ÖBB, Alpenverein und DWD/GeoSphere statt abgespeckt |

---

## 8. Arbeitsstränge ausserhalb des Codes

Diese Punkte blockieren den Launch genauso wie fehlender Code, werden aber gern vergessen.

### Recht und Store-Vorgaben

| Thema | Was es braucht | Bis |
|---|---|---|
| Datenschutzerklärung | revDSG (Schweiz), DSGVO für Nutzer aus der EU; Standort, Live-Tracking, Telefonnummer, Bewertungen, Analytics | M5 |
| Nutzungsbedingungen | Mindestalter 18 für das Matching, **Haftung bei Touren unter Privaten** (TrailMate vermittelt, organisiert nicht; keine Bergführer-Leistung), Community-Inhalte vs. offizielle Infos | M5 |
| Community-Richtlinien | Verhalten auf Touren, Haltung zu Dating, Folgen von Verstössen | M5 |
| Impressum | Pflichtangaben | M5 |
| Konto-Löschung | Apple verlangt Löschung in der App, Google zusätzlich einen Web-Link | M4 |
| Nutzerinhalte (Apple 1.2) | Melden, Blockieren, Filter, Kontakt: in der Spezifikation vorhanden, im Review sichtbar machen | M6 |
| Hintergrund-Standort | Apple: klare Begründung in Texten und Prüfnotizen. Google: Deklaration mit Video, Foreground-Service-Deklaration | M6 |
| Datenschutz-Angaben im Store | Apple „Privacy Nutrition Label“, Google „Data safety“ | M6 |
| Altersfreigabe | Fragebogen in beiden Stores, passend zu 18+ beim Matching | M6 |
| Name und Marke | Swissreg und Store-Suche, Domain | M0 |

Ich empfehle, die Rechtstexte von einem Agent entwerfen und dann **einmal von einer Fachperson prüfen** zu lassen. Gerade die Haftung bei gemeinsamen Touren ist kein Thema für Vorlagen aus dem Internet.

### Betrieb

- **Moderation:** Dok. 09 verspricht 24 Stunden für Meldungen mit hoher Priorität. Als Einzelperson heisst das: Push-Alarm aufs Handy und eine Vertretung. Plan: 1–2 vertrauenswürdige Moderatorinnen oder Moderatoren aus der Beta gewinnen.
- **Support:** E-Mail-Adresse, FAQ, Antwortvorlagen.
- **Monitoring:** Sentry für Abstürze, Supabase-Alarme, wöchentlicher Kennzahlen-Bericht.
- **Backups:** Supabase Pro mit täglichen Backups ab der Beta.

### Geschäft

- Preis und Abo-Modell (K1)
- Apple Small Business Program beantragen (15 % statt 30 % Provision)
- Treuhand: MWST, Einnahmen aus den Stores, Rechtsform
- Kosten im Blick (Abschnitt 12)

---

## 9. Arbeitsweise mit parallelen Agents

**Ein Repo, viele Branches.** Jeder Strang (A1, B2, C4 …) arbeitet auf einem eigenen Branch und öffnet einen Pull Request. `main` ist immer lauffähig.

**Jeder Agent bekommt drei Dinge:** das passende Spezifikationsdokument, die Ist-Soll-Liste dazu (aus Phase 1) und ein Bestanden-Kriterium aus diesem Plan. Damit gilt die alte Regel „immer nur ein Dokument pro Agent“ weiter, aber jetzt mit dem Wissen, was schon gebaut ist.

**Definition of Done für jeden Pull Request:**
- [ ] CI grün (Lint, Typecheck, Unit-Tests, Migrationstest)
- [ ] Neue Datenbanktabellen haben RLS und einen Test, der fremden Zugriff verbietet
- [ ] Neue Texte über i18n, nicht fest im Code
- [ ] Auf Android und iOS gebaut (EAS) und mindestens einmal gestartet
- [ ] Bei sichtbaren Änderungen: Screenshot im Pull Request

**Konflikte vermeiden:** Migrationen werden fortlaufend nummeriert und nur von einem Strang pro Woche geändert. Gemeinsame Dateien (Navigation, Theme, Typen) bekommen einen klaren Besitzer pro Phase.

**Dein Teil:** Entscheiden, draussen testen, Pull Requests stichprobenartig prüfen, mit Vereinen reden. Alles andere kann ein Agent vorbereiten.

---

## 10. Risiken und Plan B

| Risiko | Wahrscheinlichkeit | Folge | Vorbeugen | Plan B |
|---|---|---|---|---|
| Code geht verloren (kein Backup) | gering, aber jederzeit | alles weg | M0 diese Woche | keiner |
| Apple weist mehrfach zurück | mittel bis hoch | Launch rutscht | Prüfnotizen, Demo-Konto, Vorgaben aus Abschnitt 8 früh erfüllen | Ausweichtermin 19.3.; Android zuerst freigeben |
| Google-Produktionszugang verzögert | mittel | Android rutscht | Geschlossener Test ab 14.12. | iOS zuerst freigeben |
| Hintergrund-GPS auf iOS unzuverlässig | mittel | Aufzeichnung und Tempo-Faktor schwach | Ab November laufend testen | Aufzeichnung im Vordergrund mit Hinweis, Fix in v1.1 |
| Kaltstart: zu wenig Touren | hoch ohne Gegenmassnahme | Erste Nutzer finden nichts und gehen | Vereine und Botschafter ab November, garantiertes Angebot | Launch-Regionen enger (nur Zürich), Seed-Touren durch Botschafter |
| Sicherheitsvorfall auf einer Tour | gering | existenziell | Sicherheitsarchitektur 9.9, Moderation, klare Regeln | Krisenplan: Kontakt, Kommunikation, Sperre |
| Dein Prüfaufwand wird zum Engpass | hoch | Qualität sinkt oder Zeit läuft davon | E2E-Tests, klare Abnahmekriterien, Wochenblick | Prioritäten im Kurs-Check neu setzen |
| Swisstopo-Daten: Nutzungsbedingungen | gering | Karte offline nicht erlaubt | Eigene PMTiles auf R2 aus dem offiziellen Download | Rasterkarte nur online |
| Kosten laufen davon (SMS, Supabase, R2) | gering | Budget | Kosten monatlich im Kurs-Check | Verifizierung per SMS nur einmal pro Konto |

---

## 11. Nach dem Launch: Roadmap 2027 und weiter

Der Plan hört nicht beim Launch auf. Die Versionen folgen den Schweizer Wanderjahreszeiten, damit jede Erweiterung genau dann kommt, wenn sie gebraucht wird.

| Version | Zeitraum | Schwerpunkt |
|---|---|---|
| **v1.0** | 1. März 2027 | Wanderpartner-Kern, Planung mit Karte, Routing, ÖV, Wetter, Aufzeichnung, Social, Premium |
| **v1.1** | Ostern 2027 | Letzter-Bus-Wächter, Notausgang, „Wohin heute?“ für Gruppen, Hütten-Pilot, Fixes aus Hypercare |
| **v1.2** | Juni 2027 | Gewitter-Radar, Gipfelbuch, Fortschrittspfad, Marktplatz für geführte Touren (Pilot), dritte Region |
| **v1.3** | September 2027 | Nebelmeer-Finder, Zeitreise, Französisch und Romandie, Besucherlenkung (B2B-Pilot) |
| **v2.0** | November 2027 | Winter-Modus, Jahresabo als Standard, Mehrtagestouren |
| **2028** | | Web-Version, DACH-Ausbau, Wanderpass mit Partnern |

Diese Tabelle wird in R3 und R5 überarbeitet.

---

## 12. Kosten bis zum Launch (grobe Schätzung)

Die Beträge sind Richtwerte aus öffentlichen Preislisten und nicht verbindlich nachgeprüft.

| Posten | Betrag | Ab wann |
|---|---|---|
| Apple Developer Program | USD 99 pro Jahr | Oktober 2026 |
| Google Play Konto | USD 25 einmalig | Oktober 2026 |
| Supabase Pro | etwa USD 25 pro Monat | Beta (Januar 2027) |
| Cloudflare R2 | wenige Franken pro Monat | November 2026 |
| SMS-Verifizierung | einige Rappen pro SMS | Beta |
| RevenueCat | gratis bis zu einem Umsatzschwellenwert | Dezember 2026 |
| Sentry, Analytics | Gratis-Stufen reichen für den Start | Oktober 2026 |
| Domain, Landingpage | etwa CHF 20–100 pro Jahr | November 2026 |
| Rechtliche Prüfung der Texte | einmalig, je nach Fachperson | Dezember 2026 |

---

## 12a. Änderungsprotokoll

| Datum | Änderung |
|---|---|
| 11.10.2026 | Erste Fassung |
| 12.10.2026 | Ist-Soll-Listen 01–09 erstellt, Phase 1 um A7 (Push) und A8 (Vorarbeiten Kern) erweitert, A1 um sieben weitere Sicherheitspunkte; K1-Vorlage, Ideen-Backlog und AGENTS.md angelegt |

## 13. Was als Nächstes von dir kommt

1. **Ja zum Sichern des Codes** als privates GitHub-Repo. Das ist seit gestern offen und das Wichtigste diese Woche.
2. **Supabase im Dashboard fortsetzen** und Bescheid geben, ob es geklappt hat.
3. **Apple Developer Program und Google Play Konto beantragen.** Dafür musst du entscheiden, ob du als Einzelperson oder als Firma auftrittst.
4. **Testgeräte nennen:** Welches Android-Gerät und welches iPhone hast du?
5. **Termin für die Produkt-Klausur K1** in den nächsten zwei Wochen.

---

## 14. Verhältnis zu den bestehenden Dokumenten

| Dokument | Rolle ab jetzt |
|---|---|
| `docs/ROADMAP.md` (dieses Dokument) | Masterplan für Zeit, Reihenfolge, Meilensteine und Denkpausen; wird im Wochenblick aktualisiert |
| `docs/spec/00_MASTERPLAN.md` | Inhaltsverzeichnis der Spezifikation und entschiedene Fragen |
| `docs/spec/01–09` | Was gebaut wird, mit Akzeptanzkriterien |
| [`docs/ist-soll/`](ist-soll/README.md) | Was davon schon im Code steckt (erstellt 12.10.2026) |
| [`docs/reflexion/`](reflexion/K1-produkt-klausur.md) | Vorlagen und Ergebnisse von K1 und R2–R5 |
| [`docs/ideen/backlog.md`](ideen/backlog.md) | Eingang für neue Ideen |
| [`docs/AGENTS.md`](AGENTS.md) | Arbeitsregeln und Definition of Done für Coding-Agents, gehört in die Repo-Wurzel |
| Plan „Stand und Plan für den Neustart“ | Bleibt als Bestandsaufnahme vom 10.10.2026; seine Phasen sind in diesem Dokument aufgegangen |
| `notes/produkt-einschaetzung*.md` | Grundlage für K1 und Abschnitt 7 |

### Was sich gegenüber dem Neustart-Plan ändert

- Feste Daten statt offener Phasen, rückwärts vom 1. März 2027 gerechnet.
- iOS läuft von Anfang an mit statt als fünfte Phase.
- Der Durchstich prüft die Wanderpartner-Suche statt Feed und Post-Postfach.
- Neu: Ist-Soll-Listen pro Dokument, Store- und Rechtsvorgaben, Kaltstart-Strang, Reflexions- und Ideenschritte, Roadmap nach dem Launch.

---

## Quellen

- [Google Play: Testanforderungen für neue private Entwicklerkonten (12 Tester, 14 Tage)](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)
- [Android Developers: Ziel-API-Anforderungen für Google Play](https://developer.android.com/google/play/requirements/target-sdk)
- [Google Play: Ziel-API-Level, Fristen](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-419)
- [App Store Connect bleibt über die Feiertage offen (GoodBarber)](https://www.goodbarber.com/blog/app-store-connect-remains-open-during-the-holiday-season-a1124/)
- [geo.admin.ch: Allgemeine Nutzungsbedingungen (Fair Use)](https://www.geo.admin.ch/en/general-terms-of-use-fsdi)
- [opendata.swiss: Vektor-Basiskarte als MBTiles](https://ckan.opendata.swiss/dataset/vektorielle-kartenbasis-vector-tileset/resource/534c6987-51dd-4e20-9fda-3790d1f64d6b)
- [Supabase: Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- Code-Stand: direkt im Ordner `Trailmate start\TrailMate` auf Christophs PC geprüft am 11.10.2026
