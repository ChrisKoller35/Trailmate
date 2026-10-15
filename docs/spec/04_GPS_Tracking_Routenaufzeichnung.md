# TrailMate – Dokument 4: GPS-Tracking & Routenaufzeichnung

> **Ziel:** Die komplette GPS-Aufzeichnungsfunktion implementieren – vom Starten einer Tour über das Hintergrund-Tracking bis zur Tour-Zusammenfassung und GPX-Export. Zuverlässiges Background-Tracking auf iOS und Android mit Kalman-Filter, GPS-Drift-Handling und Pausenerkennung.

> **Voraussetzung:** Dokument 01 (Setup) und Dokument 03 (Karten) sind abgearbeitet. MapLibre ist integriert, die Karte funktioniert.

---

## 4.1 Routenaufzeichnung – Übersicht

### Aufgezeichnete Daten
- **GPS-Track** – der genaue Weg, auf der Karte sichtbar
- **Distanz** – zurückgelegte Kilometer
- **Höhenmeter** – separat aufwärts und abwärts
- **Gesamtzeit** und **reine Gehzeit** (ohne Pausen)
- **Durchschnittsgeschwindigkeit** (km/h)
- **Schritte**

### User Story
Als Wanderer möchte ich meine Tour aufzeichnen können, damit ich sie später ansehen, teilen und analysieren kann.

---

## 4.2 Aufzeichnungs-UI

### Start-Screen
```
┌──────────────────────────────────┐
│  🗺️ Karte (Vollbild)             │
│                                  │
│      [Nutzer-Position]           │
│                                  │
│                                  │
│                                  │
│                                  │
│  ┌──────────────────────────┐    │
│  │   ● REC    [▶️ Tour starten]│  │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

### Während der Aufzeichnung
```
┌──────────────────────────────────┐
│  🗺️ Karte mit Live-Track         │
│                                  │
│   ════ Bisheriger Track (orange) │
│      📍 Aktuelle Position        │
│                                  │
│  ┌──────────────────────────┐    │
│  │ 🔴 REC  03:24:15             │  │
│  │                              │  │
│  │ 8.4 km    ↑ 620m   ↓ 340m  │  │
│  │ 4.2 km/h                    │  │
│  │                              │  │
│  │ [⏸️ Pause]    [⏹️ Beenden]   │  │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

### Funktionen
- **Start** – Aufzeichnung mit einem Klick/Tap starten
- **GPS-Track wird auf der Karte live angezeigt** während man läuft
- **Pause** – Manuelle Pause (zusätzlich zur automatischen Pausenerkennung)
- **Stop** – Aufzeichnung beenden → Tour-Zusammenfassung
- **Live-Daten** – Distanz, Höhenmeter, Zeit, Geschwindigkeit laufend aktualisiert

---

## 4.3 Hintergrund-GPS auf iOS

### Problem
iOS throttled Background Location Updates aggressiv. Apps können im Hintergrund nur eingeschränkt auf GPS zugreifen. Jedes iOS-Update kann das Verhalten ändern.

### Lösung: Bewährtes Pattern der Outdoor-App-Industrie

**Kombination aus drei iOS-APIs:**

### API 1: Significant Location Changes (immer aktiv, batterieschonend)
- Grobe Updates alle ~500m
- Weckt die App im Hintergrund auf

### API 2: Background Location Updates (wenn Tour aktiv)
```
info.plist Einstellungen:
  UIBackgroundModes = ["location"]
  
CLLocationManager Konfiguration:
  allowsBackgroundLocationUpdate = true
  desiredAccuracy = kCLLocationAccuracyBest
  activityType = CLActivityType.fitness  (= wandern, Apple optimiert dafür)
  pausesLocationUpdatesAutomatically = false  (WICHTIG: sonst stoppt iOS!)
```

### API 3: Background Task API (als Fallback)
- `BGProcessingTask` für periodische Location-Checks
- Falls iOS die App doch suspendiert: beim Aufwachen fehlende Punkte interpolieren

### expo-location Konfiguration

```typescript
import * as Location from 'expo-location';

// Vordergrund-Berechtigung anfordern
const { status: foreground } = await Location.requestForegroundPermissionsAsync();

// Hintergrund-Berechtigung anfordern (separater Dialog auf iOS)
const { status: background } = await Location.requestBackgroundPermissionsAsync();

// Aufzeichnung starten
const startTracking = async () => {
  await Location.startLocationUpdatesAsync('TRACKING_TASK', {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 10,           // Neuer Punkt erst ab 10m Distanz
    timeInterval: 5000,             // Alle 5 Sekunden
    foregroundService: {            // Android: Persistente Notification
      notificationTitle: 'TrailMate',
      notificationBody: 'Tour wird aufgezeichnet',
      notificationColor: '#FF6B35',
    },
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true, // iOS: blauer Balken
    pausesUpdatesAutomatically: false,      // WICHTIG!
  });
};

// Aufzeichnung stoppen
const stopTracking = async () => {
  await Location.stopLocationUpdatesAsync('TRACKING_TASK');
};
```

### TaskManager für Hintergrund-Updates

```typescript
import * as TaskManager from 'expo-task-manager';

TaskManager.defineTask('TRACKING_TASK', ({ data, error }) => {
  if (error) return;
  
  const locations = (data as any).locations as Location.LocationObject[];
  
  for (const location of locations) {
    // GPS-Drift filtern
    if (location.coords.accuracy > 50) continue; // Schlechtes Signal → verwerfen
    
    // Kalman-Filter anwenden
    const filtered = applyKalmanFilter(location);
    
    // Punkt lokal in SQLite speichern
    saveTrackPoint(filtered);
  }
});
```

---

## 4.4 GPS-Drift-Handling & Kalman-Filter

### Kalman-Filter
- Auf die rohen GPS-Daten anwenden → glättet Sprünge
- Verhindert Zickzack-Linien bei Stillstand und schlechtem Signal

### Implementierung

```typescript
// lib/kalmanFilter.ts

class KalmanFilter {
  private lat: number = 0;
  private lng: number = 0;
  private variance: number = -1; // Initialer Zustand
  private readonly minAccuracy = 3; // Meter

  process(lat: number, lng: number, accuracy: number): { lat: number; lng: number } {
    if (accuracy < this.minAccuracy) accuracy = this.minAccuracy;

    if (this.variance < 0) {
      // Erster Punkt
      this.lat = lat;
      this.lng = lng;
      this.variance = accuracy * accuracy;
    } else {
      // Kalman Gain berechnen
      const k = this.variance / (this.variance + accuracy * accuracy);
      this.lat += k * (lat - this.lat);
      this.lng += k * (lng - this.lng);
      this.variance = (1 - k) * this.variance;
    }

    return { lat: this.lat, lng: this.lng };
  }
}
```

### Regeln für GPS-Filter
1. **Distanzfilter:** Neuen Punkt erst ab 10m Distanz aufzeichnen (filtert GPS-Drift bei Stillstand)
2. **Accuracy-Filter:** Punkte mit `accuracy > 50m` verwerfen (schlechtes Signal)
3. **Geschwindigkeits-basierter Filter:** Unrealistische Sprünge filtern (> 50 km/h beim Wandern)

---

## 4.5 Automatische Pausenerkennung

### Logik
- **Pause-Bedingung:** `speed < 0.3 m/s UND accuracy < 20m` → Pause erkannt
- Nicht nur Stillstand prüfen, weil GPS-Drift 20–50m betragen kann
- Pausenzeit wird separat erfasst (für Gehzeit vs. Gesamtzeit)

### Implementierung

```typescript
// lib/pauseDetection.ts

const PAUSE_SPEED_THRESHOLD = 0.3; // m/s
const PAUSE_ACCURACY_THRESHOLD = 20; // Meter
const PAUSE_DURATION_THRESHOLD = 60; // Sekunden bevor als Pause gilt

let pauseStart: number | null = null;
let totalPauseDuration = 0;

function checkPause(location: LocationObject): boolean {
  const speed = location.coords.speed ?? 0;
  const accuracy = location.coords.accuracy ?? 999;
  
  if (speed < PAUSE_SPEED_THRESHOLD && accuracy < PAUSE_ACCURACY_THRESHOLD) {
    if (!pauseStart) {
      pauseStart = Date.now();
    } else if (Date.now() - pauseStart > PAUSE_DURATION_THRESHOLD * 1000) {
      return true; // In Pause
    }
  } else {
    if (pauseStart) {
      totalPauseDuration += Date.now() - pauseStart;
      pauseStart = null;
    }
  }
  return false;
}
```

### Batterie-Optimierung
- **Adaptive Genauigkeit:**
  - In Bewegung → `kCLLocationAccuracyBest` (höchste Genauigkeit)
  - Im Stillstand (Pause erkannt) → `kCLLocationAccuracyHundredMeters` (batterieschonend)
- **Ziel: < 10% Batterie pro Stunde** bei aktiver Aufzeichnung
- Track-Punkte lokal in SQLite zwischenspeichern, Sync mit Backend nur bei WLAN oder manuell

### Nachlauf-Korrektur
- Nach Tour-Ende die letzten 2 Minuten auf GPS-Drift prüfen und ggf. kürzen
- Verhindert "Ghost-Tracks" am Ende der Tour

---

## 4.6 Lokale Speicherung (SQLite)

```typescript
// Track-Punkte lokal zwischenspeichern
// Kein Datenverlust bei App-Crash oder Netzausfall

interface TrackPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: number;
  speed: number;
  accuracy: number;
  isPause: boolean;
}

// SQLite-Tabelle für Track-Punkte
// CREATE TABLE track_points (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   recording_id TEXT NOT NULL,
//   latitude REAL NOT NULL,
//   longitude REAL NOT NULL,
//   altitude REAL,
//   timestamp INTEGER NOT NULL,
//   speed REAL,
//   accuracy REAL,
//   is_pause INTEGER DEFAULT 0
// );
```

---

## 4.7 Tour-Zusammenfassung (nach Tour-Ende)

### UI
```
┌──────────────────────────────────┐
│  🏁 Tour abgeschlossen!          │
│                                  │
│  [Karte mit aufgezeichnetem      │
│   Track]                         │
│                                  │
│  📏 Distanz:      12.4 km       │
│  ↑ Höhenmeter:    850 hm        │
│  ↓ Höhenmeter:    620 hm        │
│  ⏱️ Gesamtzeit:    4h 32min      │
│  🚶 Gehzeit:       3h 58min      │
│  ⏸️ Pausenzeit:    34min         │
│  📈 Ø Geschw.:    3.1 km/h      │
│  👣 Schritte:      18'450        │
│                                  │
│  📊 Höhenprofil                  │
│  ╱╲╱╲_╱╲____╱╲╲                 │
│                                  │
│  Titel: [_______________]        │
│                                  │
│  [📤 Im Feed teilen]             │
│  [💾 Speichern (privat)]         │
│  [📁 GPX exportieren]            │
│  [🗺️ Als Route veröffentlichen]  │
└──────────────────────────────────┘
```

### Berechnungen nach Tour-Ende

```typescript
// Distanz: Summe aller Abstände zwischen aufeinanderfolgenden Punkten
// Höhenmeter: Summe aller positiven (↑) und negativen (↓) Höhendifferenzen
// Gesamtzeit: finishedAt - startedAt
// Gehzeit: Gesamtzeit - Pausenzeit
// Ø Geschwindigkeit: Distanz / Gehzeit
// Schritte: aus Geräte-Pedometer (expo-sensors oder HealthKit/Google Fit)
```

### Daten in DB speichern

```sql
-- Recording in recordings-Tabelle speichern
INSERT INTO recordings (
    user_id, title, gpx_url, geom,
    distance_m, elevation_gain_m, elevation_loss_m,
    duration_seconds, moving_time_seconds, avg_speed_kmh, steps,
    started_at, finished_at
) VALUES (
    $userId, $title, $gpxUrl, ST_GeomFromGeoJSON($trackGeoJSON),
    $distance, $elevGain, $elevLoss,
    $duration, $movingTime, $avgSpeed, $steps,
    $startedAt, $finishedAt
);
```

---

## 4.8 GPX-Export

### Format
GPX ist Industriestandard (kompatibel mit Garmin, Google Maps, Strava etc.)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailMate">
  <trk>
    <name>Grindelwald → Kleine Scheidegg</name>
    <trkseg>
      <trkpt lat="46.6244" lon="7.9617">
        <ele>1034</ele>
        <time>2026-07-15T08:00:00Z</time>
      </trkpt>
      <trkpt lat="46.6248" lon="7.9621">
        <ele>1042</ele>
        <time>2026-07-15T08:01:00Z</time>
      </trkpt>
      <!-- ... weitere Punkte ... -->
    </trkseg>
  </trk>
</gpx>
```

### GPX-Datei generieren & exportieren

```typescript
// lib/gpxExport.ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function generateGPX(points: TrackPoint[], title: string): string {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailMate">
  <trk>
    <name>${escapeXml(title)}</name>
    <trkseg>`;
    
  for (const point of points) {
    gpx += `
      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <ele>${point.altitude}</ele>
        <time>${new Date(point.timestamp).toISOString()}</time>
      </trkpt>`;
  }
  
  gpx += `
    </trkseg>
  </trk>
</gpx>`;
  
  return gpx;
}

async function exportGPX(points: TrackPoint[], title: string) {
  const gpx = generateGPX(points, title);
  const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;
  
  await FileSystem.writeAsStringAsync(filePath, gpx);
  await Sharing.shareAsync(filePath);
}
```

- **GPX-Export ist ein Premium-Feature**
- Auch die GPX-Datei wird nach Cloudflare R2 hochgeladen → `recordings.gpx_url`

---

## 4.9 Aufzeichnungs-Historie

Alle Aufzeichnungen werden im Profil gespeichert und fliessen in die Statistiken ein.

```
┌──────────────────────────────────┐
│  📋 Meine Touren                 │
│                                  │
│  15. Juli 2026                   │
│  ┌──────────────────────────┐    │
│  │ Grindelwald → Kl. Sch.  │    │
│  │ 12.4 km | ↑850m | T3    │    │
│  │ 4h 32min                │    │
│  └──────────────────────────┘    │
│                                  │
│  12. Juli 2026                   │
│  ┌──────────────────────────┐    │
│  │ Oeschinensee Rundweg    │    │
│  │ 8.2 km | ↑420m | T2     │    │
│  │ 2h 45min                │    │
│  └──────────────────────────┘    │
│  ...                             │
└──────────────────────────────────┘
```

### Nachträgliches Zuschneiden
- Vergangene Aufzeichnungen können nachträglich zugeschnitten werden (z.B. versehentlich weitergelaufene Strecke entfernen)
- Aufwand prüfen – falls technisch gut umsetzbar: ja

---

## Akzeptanzkriterien – Dokument 4

### Aufzeichnung
- [ ] Aufzeichnung mit einem Klick starten und stoppen
- [ ] GPS-Track wird auf der Karte live angezeigt während man läuft
- [ ] Automatische Pausenerkennung wenn man stillsteht
- [ ] Pausenzeit wird separat erfasst
- [ ] Manuelle Pause-Funktion
- [ ] Nach der Tour: Zusammenfassung mit allen Kennzahlen (Distanz, Höhenmeter ↑↓, Gesamtzeit, Gehzeit, Ø Geschwindigkeit, Schritte)

### Hintergrund-GPS
- [ ] GPS-Aufzeichnung läuft zuverlässig bei gesperrtem Bildschirm
- [ ] iOS zeigt blauen Balken "TrailMate verwendet deinen Standort"
- [ ] Batterieverbrauch < 10% pro Stunde bei aktiver Aufzeichnung
- [ ] Aufzeichnung überlebt App-Wechsel und Telefonanrufe
- [ ] Bei GPS-Ausfall (Tunnel, dichter Wald): Track wird nach Wiederherstellung nahtlos fortgesetzt
- [ ] GPS-Drift im Stillstand wird gefiltert (keine Zickzack-Linien bei Pausen)

### Daten
- [ ] Tour kann als Post im Feed geteilt werden
- [ ] Export als GPX-Datei möglich (Premium)
- [ ] Aufzeichnungen werden im Profil gespeichert und fliessen in die Statistiken ein
- [ ] Track-Punkte werden lokal in SQLite zwischengespeichert (kein Datenverlust bei Crash)
- [ ] Sync mit Backend bei WLAN oder manuell

### Qualität
- [ ] Kalman-Filter glättet GPS-Sprünge
- [ ] Punkte mit accuracy > 50m werden verworfen
- [ ] Distanzfilter: Neuer Punkt erst ab 10m
- [ ] Nachlauf-Korrektur entfernt Drift am Tour-Ende

---

## Relevante Tabellen (aus Dokument 01)

- `recordings` – Tour-Aufzeichnungen (alle Kennzahlen)
- `routes` – Falls aufgezeichnete Tour als Route veröffentlicht wird
- `posts` – Falls Tour im Feed geteilt wird
