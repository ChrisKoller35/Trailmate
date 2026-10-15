# TrailMate – Dokument 7: Wetter, ÖV-Integration & Trail Conditions

> **Ziel:** Die MeteoSwiss ETL-Pipeline implementieren, yr.no als Ergänzung/Fallback integrieren, die Wetter-UI mit eigenen Icons bauen, die SBB ÖV-Integration aufsetzen und das Trail-Conditions-Meldesystem mit Gamification-Verknüpfung umsetzen. Nach diesem Dokument hat die App ein vollständiges Wetter-, Anreise- und Wegzustandsystem.

> **Voraussetzung:** Dokument 01 (DB-Schema), Dokument 03 (Karten/Routing) sind abgearbeitet. PostGIS ist aktiv, Routen funktionieren.

---

## 7.1 MeteoSwiss ETL-Pipeline

### Problem
MeteoSwiss bietet keine klassische REST-API, sondern Open-Data-Downloads (ZIP-Archive mit CSV/JSON). Die Daten müssen regelmässig gepullt, geparsed und für Location-Queries aufbereitet werden.

### Architektur

```
MeteoSwiss Open Data (HTTPS Download)
         │
         ▼
┌─────────────────────────┐
│  Supabase Edge Function  │  ← Cron: alle 60 Minuten
│  (oder Cloudflare Worker)│
│                          │
│  1. ZIP herunterladen    │
│  2. CSV/JSON parsen      │
│  3. Nearest-Station      │
│     Mapping erstellen    │
│  4. In PostGIS schreiben │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  PostGIS Tabelle:        │
│  weather_forecasts       │
│                          │
│  station_id              │
│  location (POINT geom)   │
│  station_elevation_m     │
│  forecast_time           │
│  temperature             │
│  precipitation           │
│  wind_speed              │
│  cloud_cover             │
│  weather_symbol_code     │
│  source                  │
│  updated_at              │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  API-Endpoint:           │
│  GET /weather?lat=&lng=  │
│                          │
│  → ST_DWithin Query      │
│  → Nächste 3 Stationen   │
│  → Gewichteter Schnitt   │
│     nach Distanz         │
└─────────────────────────┘
```

### MeteoSwiss-Datenquellen (konkret)
- `ogd-meteoswiss` auf data.geo.admin.ch
- Forecasts: **COSMO**-Modelldaten, stündlich aktualisiert
- Messdaten: ~260 automatische Messstationen (SwissMetNet)
- ~6'000 Messpunkte in der Schweiz
- 9-Tage-Prognose
- Temperatur, Niederschlag, Wind, Bewölkung, Sonnenschein, Wettersymbol-Klassifikation
- Download-Format: CSV mit Koordinaten (**LV95**), muss nach **WGS84** transformiert werden

### LV95 → WGS84 Transformation

```typescript
// Schweizer Landeskoordinaten (LV95) nach WGS84 umrechnen
function lv95ToWgs84(east: number, north: number): { lat: number; lng: number } {
  // Hilfswerte
  const y_aux = (east - 2600000) / 1000000;
  const x_aux = (north - 1200000) / 1000000;

  // Breite
  let lat = 16.9023892
    + 3.238272 * x_aux
    - 0.270978 * y_aux * y_aux
    - 0.002528 * x_aux * x_aux
    - 0.0447 * y_aux * y_aux * x_aux
    - 0.0140 * x_aux * x_aux * x_aux;
  lat = (lat * 100) / 36;

  // Länge
  let lng = 2.6779094
    + 4.728982 * y_aux
    + 0.791484 * y_aux * x_aux
    + 0.1306 * y_aux * x_aux * x_aux
    - 0.0436 * y_aux * y_aux * y_aux;
  lng = (lng * 100) / 36;

  return { lat, lng };
}
```

### Supabase Edge Function: Wetter-ETL

```typescript
// supabase/functions/weather-etl/index.ts

import { serve } from 'https://deno.land/std/http/server.ts';

serve(async () => {
  // 1. MeteoSwiss Open Data herunterladen
  const response = await fetch('https://data.geo.admin.ch/ch.meteoswiss.messwerte-aktuell/...');
  const zipBuffer = await response.arrayBuffer();
  
  // 2. ZIP entpacken und CSV parsen
  const csvData = await parseZip(zipBuffer);
  
  // 3. Daten transformieren (LV95 → WGS84)
  const forecasts = csvData.map(row => ({
    station_id: row.station,
    location: `SRID=4326;POINT(${lv95ToWgs84(row.east, row.north).lng} ${lv95ToWgs84(row.east, row.north).lat})`,
    station_elevation_m: row.elevation,
    forecast_time: row.timestamp,
    temperature: row.temperature,
    precipitation: row.precipitation,
    wind_speed: row.wind_speed,
    cloud_cover: row.cloud_cover,
    weather_symbol_code: row.symbol,
    source: 'meteoswiss',
  }));
  
  // 4. In PostGIS schreiben (Upsert)
  await supabase.from('weather_forecasts').upsert(forecasts, {
    onConflict: 'station_id,forecast_time',
  });
  
  return new Response('OK');
});
```

### Cron-Job (stündlich)
```sql
-- Supabase pg_cron Extension
SELECT cron.schedule(
  'weather-etl',
  '0 * * * *',  -- Jede Stunde
  $$SELECT net.http_post('https://xxxxx.supabase.co/functions/v1/weather-etl')$$
);
```

### PostGIS-Query für nächste Stationen

```sql
SELECT station_id, temperature, precipitation, wind_speed, cloud_cover,
       station_elevation_m,
       ST_Distance(location::geography, ST_MakePoint($lng, $lat)::geography) AS dist_m
FROM weather_forecasts
WHERE forecast_time BETWEEN $start AND $end
  AND ST_DWithin(location::geography, ST_MakePoint($lng, $lat)::geography, 15000)
ORDER BY dist_m
LIMIT 3;
```

### Gewichteter Schnitt nach Distanz

```typescript
// Inverse Distance Weighting (IDW)
function interpolateWeather(stations: WeatherStation[], targetLat: number, targetLng: number): Weather {
  const totalWeight = stations.reduce((sum, s) => sum + (1 / s.dist_m), 0);
  
  return {
    temperature: stations.reduce((sum, s) => sum + s.temperature * (1 / s.dist_m), 0) / totalWeight,
    precipitation: stations.reduce((sum, s) => sum + s.precipitation * (1 / s.dist_m), 0) / totalWeight,
    wind_speed: stations.reduce((sum, s) => sum + s.wind_speed * (1 / s.dist_m), 0) / totalWeight,
  };
}
```

---

## 7.2 Höhenkorrektur (Premium-Feature)

### Formel
Bergwetter muss auf die Höhe der Route interpoliert werden, nicht nur auf die nächste Wetterstation.

**Temperatur sinkt ~0.6°C pro 100 Höhenmeter**

```typescript
function correctTemperature(
  stationTemp: number,
  stationElevation: number,
  routeElevation: number
): number {
  const elevationDiff = routeElevation - stationElevation;
  const correction = (elevationDiff / 100) * -0.6;
  return stationTemp + correction;
}

// Beispiel:
// Station auf 600m: 22°C
// Route auf 2100m: 22 + ((2100-600)/100 * -0.6) = 22 - 9.0 = 13°C
```

Die Höhe des Route-Punkts kommt aus Swisstopo DEM (Digital Elevation Model).

---

## 7.3 yr.no Integration (DE/AT + Fallback CH)

### REST-API – deutlich einfacher als MeteoSwiss

```typescript
// Supabase Edge Function: yr.no Proxy
const getYrNoForecast = async (lat: number, lng: number) => {
  const response = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`,
    {
      headers: {
        'User-Agent': 'TrailMate/1.0 info@trailmate.ch',
      },
    }
  );
  
  const data = await response.json();
  return data.properties.timeseries; // Stündliche Prognose
};
```

### Nutzung
- **Für DE/AT:** yr.no als primäre Wetterdatenquelle
- **Für CH:** yr.no als Fallback bei MeteoSwiss-Ausfall
- Rate Limit beachten (fair use, keine harte Grenze)

---

## 7.4 Wetter-UI

### Wetter auf der Route

```
┌──────────────────────────────────┐
│  🌤️ Wetter für diese Route       │
│  Source: MeteoSwiss              │
│                                  │
│  [Stündlich] [Täglich]           │
│                                  │
│  Heute, 15. Juli                 │
│  ┌──────────────────────────┐    │
│  │ 08:00  🌤️  14°C  💨 8km/h│    │
│  │ 10:00  ☀️  18°C  💨 5km/h │    │
│  │ 12:00  ☀️  22°C  💨 3km/h │    │
│  │ 14:00  ⛅  20°C  💨 10km/h│    │
│  │ 16:00  🌧️  16°C  💨 15km/h│    │
│  └──────────────────────────┘    │
│                                  │
│  ⚠️ Gewitter ab 16:00 möglich    │
│                                  │
│  9-Tage-Prognose:                │
│  Mo  Di  Mi  Do  Fr  Sa  So     │
│  ☀️  ☀️  ⛅  🌧️  🌧️  ⛅  ☀️      │
│  22° 23° 20° 15° 14° 18° 21°    │
└──────────────────────────────────┘
```

### Funktionen
- Wetter wird für den **genauen Routenstandort** angezeigt
- **9-Tage-Prognose** verfügbar, stündlich aktualisiert
- Nutzer kann zwischen **stündlicher und täglicher** Ansicht wechseln
- **Warnungen** bei Gewitter, Sturm oder starkem Schneefall
- **Eigene Wetter-Icons** (keine MeteoSwiss-Grafiken übernehmen!)
- **Quellenangabe** "Source: MeteoSwiss" in der App sichtbar

### Eigene Wetter-Icons erstellen
MeteoSwiss-Wettersymbole dürfen nicht übernommen werden. Eigene Icons für:
- Sonne, teilweise bewölkt, bewölkt, Regen, Schnee, Gewitter, Nebel, Wind
- Tag- und Nachtversionen
- Format: SVG (über `react-native-svg`)

### Offline-Wetter
- Letzte bekannte Prognose wird offline gecached
- Für offline gespeicherte Routen: letztes bekanntes Wetter anzeigen mit Hinweis "Zuletzt aktualisiert: ..."

---

## 7.5 SBB/ÖV-Integration

### Problem
In der Schweiz wandert man oft mit ÖV-Anreise. "Wie komme ich zum Startpunkt?" ist eine der häufigsten Planungsfragen.

### SBB Open Data API

```
GET https://transport.opendata.ch/v1/connections
    ?from=Bern
    &to=Grindelwald
    &date=2026-07-15
    &time=07:00
```

Antwort: Verbindungen mit Umsteigezeiten, Gleis, Dauer

### Integration in die Routenplanung

```
┌──────────────────────────────────┐
│  Route: Grindelwald → Kleine     │
│         Scheidegg                │
│                                  │
│  📊 12.4 km | ↑ 850 hm | T3     │
│  ⏱️  ~4h 30min                   │
│                                  │
│  🚂 Anreise                      │
│  ├── Bern ab 07:04               │
│  ├── Interlaken Ost um 07:56     │
│  └── Grindelwald an 08:34        │
│                                  │
│  🚂 Rückreise                    │
│  ├── Kleine Scheidegg ab 15:15   │
│  └── Bern an 17:24              │
│                                  │
│  [SBB Ticket kaufen →]           │
└──────────────────────────────────┘
```

### Technische Umsetzung

```typescript
// lib/publicTransport.ts

interface Connection {
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  transfers: number;
  sections: Section[];
}

async function getConnections(from: string, to: string, date: string, time: string): Promise<Connection[]> {
  const response = await fetch(
    `https://transport.opendata.ch/v1/connections?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}&time=${time}`
  );
  const data = await response.json();
  return data.connections;
}

// Nächste ÖV-Haltestelle zum Route-Startpunkt finden
async function findNearestStation(lat: number, lng: number): Promise<string> {
  const response = await fetch(
    `https://transport.opendata.ch/v1/locations?x=${lat}&y=${lng}&type=station`
  );
  const data = await response.json();
  return data.stations[0]?.name;
}
```

### Funktionen
- Nächste ÖV-Haltestelle zum Start-/Endpunkt der Route automatisch finden
- Standardmässig Verbindung für "morgen früh" vorschlagen
- Nutzer kann Datum/Zeit anpassen
- **Deep-Link zur SBB-App** für Ticketkauf (kein eigenes Ticketing)
- Funktioniert nur bei bestehender Internetverbindung
- Für DE/AT: Deutsche Bahn API → **Phase 2**

---

## 7.6 Trail Conditions (Wegzustandsberichte)

### Konzept
Aktuelle Wegzustände sind eine der wertvollsten Informationen beim Wandern. Community-Mehrwert durch Zustandsberichte – das Feature wo eine Community echten, nicht-austauschbaren Mehrwert schafft.

### Quick-Report UI

```
┌──────────────────────────────────┐
│  📢 Wegzustand melden            │
│                                  │
│  Route: Grindelwald → Kl. Sch.  │
│  Datum: Heute, 15. Juli 2026    │
│                                  │
│  Zustand:                        │
│  ☑️ Weg offen und gut begehbar   │
│  ☐ Schneefelder vorhanden       │
│  ☐ Weg nass/rutschig            │
│  ☐ Steinschlaggefahr            │
│  ☐ Weg teilweise gesperrt       │
│  ☐ Brücke/Steg beschädigt       │
│                                  │
│  Schneegrenze ca.: [__2400__] m  │
│                                  │
│  📷 Foto hinzufügen (optional)   │
│                                  │
│  Kommentar (optional):           │
│  [Ab Bort Schneefeld, Spuren    │
│   vorhanden, Stöcke empfohlen]  │
│                                  │
│  [Melden]                        │
└──────────────────────────────────┘
```

### Anzeige bei Routenplanung
- Badge auf der Route: "Letzter Bericht: vor 2 Tagen"
- Aktuelle Meldungen werden direkt auf der Routenseite angezeigt
- Ältere Meldungen (> 14 Tage) werden ausgegraut mit Hinweis "Veraltet – melde den aktuellen Zustand"
- Schneegrenze wird auf der Karte als Höhenlinie visualisiert

### Upvoting
- Nutzer können Berichte als "hilfreich" markieren (Upvote)
- `helpfulness_score` in `trail_conditions` Tabelle

### Gamification-Verknüpfung
- **"Trail Reporter"-Badge** für 5 Zustandsmeldungen
- **"Pfadfinder"-Badge** für 25 Meldungen
- Meldungen geben Karma/Punkte die auf dem Profil sichtbar sind

### Push-Notification
- Wenn für eine **gemerkte Route** ein neuer Bericht vorliegt → Push-Benachrichtigung

### Auto-Archivierung
```sql
-- Berichte älter als 14 Tage als "veraltet" markieren
UPDATE trail_conditions 
SET expires_at = NOW() 
WHERE reported_at < NOW() - INTERVAL '14 days' 
AND expires_at IS NULL;
```

---

## Akzeptanzkriterien – Dokument 7

### Wetter
- [ ] Wetterdaten werden stündlich aktualisiert (Cron-Job)
- [ ] Wetter wird für den genauen Routenstandort angezeigt
- [ ] 9-Tage-Prognose verfügbar
- [ ] Nutzer kann zwischen stündlicher und täglicher Ansicht wechseln
- [ ] Warnungen bei Gewitter, Sturm oder starkem Schneefall
- [ ] Eigene Wetter-Icons (keine MeteoSwiss-Grafiken)
- [ ] Quellenangabe "Source: MeteoSwiss" sichtbar
- [ ] Temperatur wird auf die Höhe des Route-Punkts interpoliert (Premium)
- [ ] Fallback bei MeteoSwiss-Ausfall: yr.no für Schweizer Standorte
- [ ] Letzte bekannte Prognose wird offline gecached
- [ ] LV95 → WGS84 Koordinatentransformation funktioniert

### ÖV
- [ ] Bei jeder Route wird die nächste ÖV-Haltestelle zum Start und Ziel angezeigt
- [ ] ÖV-Verbindungen werden automatisch vorgeschlagen
- [ ] Datum und Uhrzeit sind anpassbar
- [ ] Deep-Link zur SBB-App oder SBB-Website für Ticketkauf
- [ ] Funktioniert nur bei bestehender Internetverbindung
- [ ] Über transport.opendata.ch (kostenlos)

### Trail Conditions
- [ ] Quick-Report mit vordefinierten Zustandskategorien (Checkboxen)
- [ ] Optionale Schneegrenze in Metern
- [ ] Optionaler Freitext und Foto
- [ ] Zustandsberichte auf der Routenseite sichtbar, sortiert nach Datum
- [ ] Berichte älter als 14 Tage werden als "veraltet" markiert
- [ ] Nutzer können Berichte als "hilfreich" markieren (Upvote)
- [ ] Verknüpfung mit Gamification (Trail-Reporter-Badge)
- [ ] Push-Notification bei neuem Bericht für gemerkte Route

---

## Relevante Tabellen (aus Dokument 01)

- `weather_forecasts` – Wetterdaten mit PostGIS-Location
- `trail_conditions` – Wegzustandsberichte
- `routes` – Für Route-Verknüpfung
- `route_bookmarks` – Für Push-Benachrichtigung bei gemerkten Routen
- `badges` – Trail Reporter / Pfadfinder Badges
