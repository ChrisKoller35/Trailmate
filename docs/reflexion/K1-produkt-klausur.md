# K1 – Produkt-Klausur (Vorlage)

*Vorbereitet am 12.10.2026 für die Klausur in KW 42/43. Dauer etwa 3 Stunden, gern in zwei Hälften. Grundlage: [ROADMAP.md](../ROADMAP.md) Abschnitt 6, die beiden Produkteinschätzungen unter `notes/` und Dokument 09.*

> So geht es: Zu jedem Punkt steht mein Vorschlag mit Begründung. Du schreibst unter „Entscheid“ dein Ja, Nein oder deine Variante. Alles, was offen bleibt, kommt in die Liste am Ende. Nach der Klausur übertrage ich die Entscheide in 00_MASTERPLAN.md und die betroffenen Dokumente.

---

## Teil 1: Das Produkt (ca. 90 Minuten)

### 1.1 Positionierung in einem Satz

**Vorschlag:** *TrailMate bringt Menschen zusammen, die wandern wollen, und plant die Tour für alle gleich mit.*

Warum dieser Satz: Er nennt zuerst den Kern (Menschen finden) und dann das, was eine Gruppe in der App hält (Planung). Er ist in 5 Sekunden erklärbar und grenzt sich von Komoot („plane deine Tour“) und Instagram („teile deine Fotos“) ab.

Alternativen zum Abwägen:
- *Die App, über die man in der Schweiz Leute zum Wandern findet.* (enger, klarer, lässt die Planung weg)
- *Nie mehr allein wandern.* (emotional, als Slogan brauchbar, als Positionierung zu vage)

**Entscheid:** ___

### 1.2 Zielgruppen für den Launch

**Vorschlag, in dieser Reihenfolge:**
1. Zugezogene und Expats in Zürich und Bern (grösstes Bedürfnis, höchste Bereitschaft, eine neue App zu testen, oft englischsprachig)
2. Leute, deren Freundeskreis nicht wandert oder ein anderes Niveau hat
3. Frauen, die nicht allein gehen möchten
4. Einsteiger, die sich steigern wollen und jemanden mit Erfahrung brauchen
5. Erfahrene, die gern Touren leiten oder Einsteiger mitnehmen (sie sind die wichtigsten Nutzer für das Angebot)

Bewusst nicht im Fokus beim Launch: Familien mit kleinen Kindern, Mehrtagestouren, Winter- und Skitouren. Die kommen mit v1.1 bis v2.0.

**Entscheid:** ___

### 1.3 Haltung zu Dating

**Vorschlag:** TrailMate ist eine Wander-App, keine Dating-App. Das steht in den Community-Richtlinien, unerwünschte Annäherungen werden als Meldegrund mit hoher Priorität behandelt, und Profile zeigen keine Angaben, die nur für Dating relevant wären (Beziehungsstatus, „suche“). Das macht die App für Frauen und Einsteiger sicher, und genau die brauchst du für eine gesunde Community. Wer sich auf einer Tour kennenlernt und mehr daraus wird, ist natürlich kein Problem.

**Entscheid:** ___

### 1.4 Launch-Umfang

Alles aus den Dokumenten 01–09 ist für v1.0 geplant. Zusätzlich empfehle ich vier Ideen in v1.0 (Begründung in ROADMAP Abschnitt 7):

| Idee | Empfehlung | Entscheid |
|---|---|---|
| GPX-Import früherer Touren (Strava, Komoot, Garmin) | **Ja**, sonst starten alle mit leerem Vertrauensprofil | ___ |
| Mutterkuh- und Herdenschutzhund-Meldungen als Wegzustand-Kategorie | Ja, kleiner Aufwand | ___ |
| Familien- und Genussfilter (Brätlistelle, Bergsee, Restaurant, Kinderwagen) | Ja, wenn die Routendaten es hergeben | ___ |
| Letzte Rückfahrt in jeder Tourkarte | Ja, kleiner Aufwand | ___ |

Gibt es etwas aus 01–09, das du **bewusst erst nach dem Launch** willst? Kandidaten, die den Kern am wenigsten stützen: Video-Posts (Dok. 05), Communities mit B2B-Verifizierung (Dok. 06), Jahresrückblick und Heatmap (Dok. 08). Ich würde sie drin lassen, weil Agentenkapazität da ist, aber sie wären die ersten, die bei einem Kurs-Check rutschen.

**Entscheid:** ___

### 1.5 Preis und Abo

Heute in der Spec: Free, Premium CHF 1.99/Monat, CHF 19.99/Jahr, 30 Tage Testphase ohne Kreditkarte.

**Vorschlag:**
- **Premium CHF 4.90/Monat oder CHF 39/Jahr**, Jahresabo als Standard im Bezahl-Screen. Begründung: CHF 1.99 signalisiert Hobbyprojekt; Komoot und Strava liegen bei CHF 50–80 pro Jahr; nach Store-Provision (15 %) und MWST (8.1 %) bleiben von CHF 1.99 nur etwa CHF 1.55.
- **Gratis bleibt:** Touren finden und mitkommen, eine eigene offene Tour pro Monat ausschreiben, Sicherheit komplett (Verifizierung, Melden, Live-Tracking bei Touren mit Neuen), Karte online, Routen, Aufzeichnung unbegrenzt, Wetter-Basis, ÖV.
- **Premium:** unbegrenzte Ausschreibungen, Spontan-Modus mit automatischen Vorschlägen, erweiterte Filter (Tempo, Sprache, Stil), Offline-Karten, Live-Tracking für eigene Touren, erweiterte Statistiken, Jahresrückblick. Ab v1.1 kommen die Planungs-Werkzeuge dazu (Letzter-Bus-Wächter, Gewitter-Radar).
- **Gründer-Angebot:** Die ersten 500 Nutzer (oder alle aus der Beta) bekommen ein Jahr Premium gratis. Das kostet nichts und gibt der Beta einen Grund.
- **Testphase:** 14 Tage statt 30, über die Stores (Apple und Google unterstützen das direkt, keine eigene Logik nötig).

Zu prüfen: Rechnet sich das? Mit 10'000 Registrierten und 4 % Conversion wären das 400 Zahlende, also etwa CHF 13'000 netto im Jahr. Das deckt die Infrastruktur, aber kein Einkommen. Das grössere Potenzial liegt bei Organisationen und dem Marktplatz für geführte Touren (v1.2). Das Abo ist also am Anfang eher ein Signal als eine Einnahmequelle.

**Entscheid Preis:** ___ **Entscheid Gründer-Angebot:** ___ **Entscheid Testphase:** ___

### 1.6 Regionen und Store-Land

**Vorschlag:** App nur im Schweizer App Store und bei Google Play Schweiz. Matching freigeschaltet in Zürich und Bern (Polygon um die Agglomeration, Treffpunkt-Reichweite 120 Minuten ÖV). Rest der Schweiz: App nutzbar, Matching mit Hinweis und Warteliste pro Region.

Warum nicht gleich DE und AT: Der Heimvorteil (Swisstopo, SBB, MeteoSwiss) fehlt dort, und ein EU-Store-Eintrag mit Abo verlangt öffentliche Händlerangaben (Name, Adresse, Telefon) nach dem Digital Services Act. Liechtenstein kann mit.

Dritte Region im Juni 2027: Basel oder Luzern? (Entscheid erst in R5.)

**Entscheid:** ___

### 1.7 Woher kommen die Routen?

Dokument 03 verlangt eine Routendatenbank. Das Wanderwegnetz von Swisstopo ist offen, aber **Tourenbeschreibungen und Fotos** gehören jemandem.

**Vorschlag:**
- Routen werden aus dem Swisstopo-Wanderwegnetz **selbst zusammengestellt** (Start, Ziel, Zwischenpunkte), Beschreibung von einem Agent entworfen und von dir stichprobenartig geprüft, Fotos anfangs aus eigenen Touren und von Botschaftern, sonst ohne Foto mit Kartenvorschau.
- Keine Übernahme von SchweizMobil-, Komoot- oder Hikr-Texten.
- 300 Routen in den Startregionen bis M2, danach wächst die Datenbank über Nutzer (aufgezeichnete Touren werden mit Zustimmung zu öffentlichen Routen).

**Entscheid:** ___

## Teil 2: Das Geschäft (ca. 60 Minuten)

### 2.1 Einzelperson oder Firma in den Stores

Der Name, der im Store als Anbieter steht, ist entweder dein Name oder ein Firmenname.

| | Einzelperson | Einzelfirma / GmbH |
|---|---|---|
| Apple-Konto | 1–2 Tage | braucht D-U-N-S-Nummer, bis 2 Wochen |
| Anbietername im Store | dein Name | Firmenname |
| Haftung | persönlich | Einzelfirma persönlich, GmbH beschränkt |
| Aufwand jetzt | keiner | Gründung, Treuhand |

**Vorschlag:** Jetzt als Einzelperson starten, damit die Konten diese Woche beantragt werden können. Die Übertragung an eine Firma ist bei Apple und Google später möglich. Wenn der Marktplatz für geführte Touren kommt (v1.2), ist eine GmbH wegen der Haftung sinnvoll. Falls du schon eine Firma hast, gleich damit.

**Entscheid:** ___

### 2.2 Haftung bei Touren unter Privaten

Das ist der wichtigste rechtliche Punkt. TrailMate vermittelt, organisiert aber keine Touren. Wer eine offene Tour ausschreibt, ist eine Privatperson, keine Bergführerin. Das muss in den Nutzungsbedingungen klar stehen, zusammen mit: Eigenverantwortung, Hinweis auf Versicherung (Unfallversicherung, Rega-Gönnerschaft), und der Trennung zwischen Community-Angaben (Wegzustand von Nutzern) und offiziellen Daten.

**Vorschlag:** Agent entwirft die Texte bis Dezember, eine Fachperson prüft sie einmal. Budget dafür einplanen.

**Entscheid:** ___

### 2.3 Organisationen und Botschafter

**Vorschlag:** Gratis-Grundpaket für Vereine (Touren ausschreiben, Anmeldungen verwalten, CSV-Import). Botschafter bekommen Premium gratis, eine sichtbare Rolle im Profil und ab und zu Material (Stickers, T-Shirt). Keine Bezahlung.

Erste Liste von Ansprechpartnern, die ich bis November ausarbeite: SAC-Sektionen Uto (Zürich) und Bern, Naturfreunde Zürich und Bern, Pro Senectute Wandergruppen, ASVZ und Unisport Bern, Expat-Gruppen (InterNations, Meetup-Wandergruppen), Zürcher und Berner Wanderwege.

Wer spricht sie an? Das muss ein Mensch tun. Ich bereite Mailvorlagen und ein einseitiges Infoblatt vor.

**Entscheid:** ___

### 2.4 Budget bis zum Launch

Siehe ROADMAP Abschnitt 12. Grob CHF 500–1'500 Infrastruktur und Konten, plus die rechtliche Prüfung. Gibt es eine Obergrenze?

**Entscheid:** ___

## Teil 3: Die Arbeitsweise (ca. 30 Minuten)

### 3.1 Dein Zeitbudget

Wie viele Stunden pro Woche kannst du realistisch für Entscheide, Tests draussen und Gespräche mit Vereinen einsetzen? Der Plan geht von etwa 5–8 Stunden pro Woche aus, davon ein Wochenende pro Monat draussen.

**Entscheid:** ___

### 3.2 Testgeräte

Welches Android-Gerät, welches iPhone, und gibt es einen Mac (nicht nötig dank EAS Build, aber praktisch für Simulatoren)?

**Antwort:** ___

### 3.3 Kommunikation

Wochenblick jeden Sonntag als Nachricht hier im Projekt; Kurs-Check am Monatsende. Reicht das, oder willst du häufiger oder seltener hören?

**Entscheid:** ___

---

## Offene Punkte nach der Klausur

| Punkt | Wer | Bis |
|---|---|---|
| | | |

## Übertragen in

- [ ] 00_MASTERPLAN.md: Entschiedene Fragen ergänzen
- [ ] 08: Preis und Premium-Tabelle
- [ ] 09.17 und 09.18: Premium-Grenzen, Regionen
- [ ] ROADMAP.md: Abschnitt 7 (Ideen) und Abschnitt 12 (Kosten)
