# TrailMate – Dokument 3: Karten, Geodaten & Routing

> **Ziel:** MapLibre-Karten mit Swisstopo-Daten integrieren, Offline-Karten implementieren (Premium), die Routing-Engine mit pgRouting aufsetzen, den Routenplanungs-Screen bauen und SAC-Filter umsetzen. Nach diesem Dokument können Nutzer Karten sehen, Regionen offline speichern, Routen suchen/planen und filtern.

> **Voraussetzung:** Dokument 01 (Projekt-Setup, DB-Schema) ist vollständig abgearbeitet.

---

## 3.1 MapLibre-Integration

### MapLibre React Native Setup

**Paket:** `@maplibre/maplibre-react-native` (bereits in Dokument 01 installiert)

MapLibre React Native ist ein Open-Source-Fork von Mapbox, speziell für React Native weiterentwickelt.

| Kriterium | Mapbox | MapLibre |
|---|---|---|
| Offline-Caching Android | ⚠️ Trickig | ✅ Zuverlässig |
| Kosten | Ab 25k User kostenpflichtig | Komplett kostenlos |
| Swisstopo-Integration | ✅ | ✅ |
| React Native Support | ✅ | ✅ |

### Swisstopo Tile-Server (Option A – empfohlen für Start)

Offizieller Swisstopo Tile-Server direkt nutzen. Kostenlos, keine eigene Infrastruktur nötig, sofort einsatzbereit.

**Tile-URL:**
```
https://vectortiles.geo.admin.ch/tiles/ch.swisstopo.base/{z}/{x}/{y}.pbf
```

**Style-URL:**
```
https://vectortiles.geo.admin.ch/styles/ch.swisstopo.base.vt/style.json
```

### Karten-Komponente

```typescript
// components/map/TrailMap.tsx
import MapLibreGL from '@maplibre/maplibre-react-native';

const SWISSTOPO_STYLE = 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.base.vt/style.json';

export function TrailMap() {
  return (
    <MapLibreGL.MapView
      style={{ flex: 1 }}
      styleURL={SWISSTOPO_STYLE}
      logoEnabled={false}
    >
      <MapLibreGL.Camera
        defaultSettings={{
          centerCoordinate: [8.2275, 46.8182], // Mitte der Schweiz
          zoomLevel: 8,
        }}
      />
      <MapLibreGL.UserLocation visible={true} />
    </MapLibreGL.MapView>
  );
}
```

### Langfristige Option B (bei Wachstum)
Swisstopo-Vektortiles selbst über Cloudflare R2 hosten. Da MapLibre keine API-Keys für Tile-Serving braucht, entstehen keine zusätzlichen Lizenzkosten. Ergibt komplette Unabhängigkeit bei den Kartendaten.

---

## 3.2 Offline-Karten (Premium-Feature)

### Beschreibung
Nutzer können gezielt Kartenregionen (Kanton oder Wandergebiet) auf ihr Gerät herunterladen und ohne Mobilfunksignal navigieren. Offline-Karten sind ein **Premium-Feature**.

### Regionen

Karten sind nach Kanton oder Wandergebiet downloadbar, z.B.:
- Berner Oberland
- Wallis
- Engadin
- Zentralschweiz
- Ostschweiz
- Tessin
- etc.

**Grösse:** Einzelne Kantone ca. 30–80 MB pro Region

### Offline-Pack-Management

```typescript
// hooks/useOfflineMaps.ts

interface OfflineRegion {
  name: string;
  bounds: [[number, number], [number, number]]; // SW, NE corners
  minZoom: number;
  maxZoom: number;
  sizeEstimateMB: number;
}

// Vordefinierte Regionen
const REGIONS: OfflineRegion[] = [
  {
    name: 'Berner Oberland',
    bounds: [[7.2, 46.3], [8.4, 46.9]],
    minZoom: 8,
    maxZoom: 16,
    sizeEstimateMB: 65,
  },
  {
    name: 'Wallis',
    bounds: [[6.7, 45.9], [8.5, 46.5]],
    minZoom: 8,
    maxZoom: 16,
    sizeEstimateMB: 75,
  },
  // ... weitere Regionen
];

// Download starten
const downloadRegion = async (region: OfflineRegion) => {
  await MapLibreGL.offlineManager.createPack({
    name: region.name,
    styleURL: SWISSTOPO_STYLE,
    bounds: region.bounds,
    minZoom: region.minZoom,
    maxZoom: region.maxZoom,
  });
};

// Download-Status abfragen
// Gespeicherte Regionen auflisten
// Region löschen
```

### Offline-Karten UI

```
┌──────────────────────────────────────┐
│  📥 Offline-Karten           [Premium]│
│                                      │
│  Gespeichert:                        │
│  ☑ Berner Oberland    65 MB  [🗑️]   │
│  ☑ Wallis             72 MB  [🗑️]   │
│                                      │
│  Belegter Speicher: 137 MB           │
│                                      │
│  Verfügbare Regionen:                │
│  ○ Engadin            58 MB  [⬇️]    │
│  ○ Zentralschweiz     45 MB  [⬇️]    │
│  ○ Ostschweiz         52 MB  [⬇️]    │
│  ○ Tessin             40 MB  [⬇️]    │
│  ...                                 │
└──────────────────────────────────────┘
```

### Auto-Update
- Beim nächsten Online-Sein werden gespeicherte Regionen automatisch auf Wegänderungen geprüft und aktualisiert
- Nutzer sieht welche Regionen gespeichert sind und kann sie einzeln löschen
- Kein technisches Limit für gespeicherte Regionen – der verfügbare Gerätespeicher ist die natürliche Grenze
- App zeigt an wie viel Speicher belegt ist

---

## 3.3 Routendatenbank

### Datenquellen für Routen

**Quelle 1: SchweizMobil / Swisstopo Wanderwege**
- ~65'000 km markierte Wanderwege in der Schweiz
- Verfügbar als Open Data (Swisstopo Vector Tiles + GeoJSON)
- SAC-Schwierigkeitsgrad ist pro Wegsegment hinterlegt
- ABER: Das sind Wegsegmente, keine fertigen Routen → Routing-Engine nötig

**Quelle 2: Community-Routen**
- Nutzer zeichnen Touren auf → GPS-Track wird gespeichert
- Nutzer können Touren "veröffentlichen" (Route + Beschreibung + Fotos)
- Veröffentlichte Routen erscheinen in der Routendatenbank
- Wächst organisch mit der Community

**Quelle 3: Kuratierte Routen (TrailMate-Team)**
- 100–200 handverlesene Top-Touren zum Launch
- Professionelle Beschreibungen, Fotos, Tipps
- Decken alle Regionen und Schwierigkeitsgrade ab
- Seed-Content für die Routensuche

---

## 3.4 Routing-Engine (pgRouting)

### Wanderweg-Netzwerk importieren

Die Swisstopo-Wanderwege sind ein Netzwerk aus Wegsegmenten. Die `hiking_network` Tabelle (aus Dokument 01) speichert diese:

```sql
-- Bereits in Dokument 01 erstellt:
-- hiking_network mit id, geom, source, target, length_m, 
-- elevation_gain, elevation_loss, sac_scale, surface, cost
```

### Swisstopo-Daten importieren

1. Swisstopo Wanderwege-GeoJSON herunterladen
2. In `hiking_network` Tabelle importieren
3. pgRouting-Topologie aufbauen:

```sql
-- pgRouting-Netzwerk aufbauen (Source/Target Nodes)
SELECT pgr_createTopology('hiking_network', 0.0001, 'geom', 'id');
```

### Point-to-Point Routing (MVP)

```
Nutzer tippt Start und Ziel auf der Karte
         │
         ▼
Backend berechnet Route über das Wanderweg-Netzwerk
(pgRouting auf PostGIS, basierend auf Swisstopo-Wegsegmenten)
         │
         ▼
Route wird angezeigt mit:
- Distanz, Höhenmeter, geschätzte Dauer
- SAC-Schwierigkeitsgrad (höchster Grad auf der Route)
- Höhenprofil
- Wetter am Start- und Zielpunkt
```

### Routing-Query (Dijkstra mit SAC-Filter)

```sql
SELECT * FROM pgr_dijkstra(
    'SELECT id, source, target, cost FROM hiking_network 
     WHERE sac_scale <= ''T3''',  -- Filter: max. T3
    start_node_id,
    end_node_id,
    directed := false
);
```

### Nächsten Netzwerk-Knoten finden (Snap-to-Network)

```sql
-- Nächsten Knoten zum Tap-Punkt auf der Karte finden
SELECT id, source
FROM hiking_network
ORDER BY geom <-> ST_SetSRID(ST_MakePoint($lng, $lat), 4326)
LIMIT 1;
```

### Route-Details berechnen

```sql
-- Nach dem Routing: Details aggregieren
SELECT 
    SUM(length_m) AS total_distance_m,
    SUM(elevation_gain) AS total_elevation_gain,
    SUM(elevation_loss) AS total_elevation_loss,
    MAX(sac_scale) AS max_difficulty,
    ST_Union(geom) AS route_geom
FROM hiking_network
WHERE id IN (... routing_result_edge_ids ...);
```

### Geschätzte Dauer berechnen

```
Formel (SAC-Norm):
- Horizontalzeit: 1 Stunde pro 4 km
- Aufstiegszeit: 1 Stunde pro 400 Höhenmeter
- Abstiegszeit: 1 Stunde pro 800 Höhenmeter
- Zeiten werden addiert, der kleinere Wert wird halbiert
```

### Rundwanderungen
- Für den MVP: kuratierte Rundwanderungen manuell als GPX hinterlegen
- Automatische Rundwanderungs-Berechnung → Phase 2 (deutlich komplexer)

---

## 3.5 Routenplanung am Kartenscreen

### UI-Layout

```
┌──────────────────────────────────┐
│  🗺️ Karte (Vollbild)             │
│                                  │
│   📍 Startpunkt (Tap oder Suche) │
│   📍 Zwischenstopp (optional)    │
│   📍 Zielpunkt                   │
│                                  │
│   ═══ Route wird auf Karte       │
│       eingezeichnet              │
│                                  │
├──────────────────────────────────┤
│  Distanz: 12.4 km               │
│  ↑ 850 hm  ↓ 620 hm            │
│  Dauer: ~4h 30min               │
│  Schwierigkeit: T3              │
│  📊 Höhenprofil anzeigen        │
│                                  │
│  [Route speichern] [Navigation]  │
└──────────────────────────────────┘
```

### Funktionen

1. **Start setzen:** Tap auf Karte oder Ortssuche
2. **Ziel setzen:** Tap auf Karte oder Ortssuche
3. **Zwischenstopps:** Optional, zwischen Start und Ziel einfügen
4. **Route berechnen:** Backend-Call → pgRouting → Route auf Karte zeichnen
5. **Route-Info Panel:** Distanz, Höhenmeter (↑/↓), geschätzte Dauer, SAC-Schwierigkeitsgrad
6. **Höhenprofil:** Anzeige des Höhenverlaufs der Route (SVG-Chart mit `react-native-svg`)
7. **Route speichern:** In persönliche Merkliste (Bookmark) → `route_bookmarks` Tabelle
8. **Navigation starten:** Zum GPS-Tracking wechseln (Dokument 04)

### Route auf der Karte zeichnen

```typescript
// Route-LineString von der API als GeoJSON
<MapLibreGL.ShapeSource id="route" shape={routeGeoJSON}>
  <MapLibreGL.LineLayer
    id="routeLine"
    style={{
      lineColor: '#FF6B35',
      lineWidth: 4,
      lineCap: 'round',
      lineJoin: 'round',
    }}
  />
</MapLibreGL.ShapeSource>
```

---

## 3.6 Schwierigkeitsgrad-Filter (SAC-Skala)

### SAC-Skala Übersicht
- **T1** – Wandern (einfach, für alle geeignet)
- **T2** – Bergwandern (gute Kondition, normale Wanderschuhe)
- **T3** – Anspruchsvolles Bergwandern (Schwindelfreiheit empfohlen)
- **T4** – Alpinwandern (Bergerfahrung nötig)
- **T5** – Anspruchsvolles Alpinwandern (alpine Erfahrung nötig)
- **T6** – Schwieriges Alpinwandern (Experten)

Die Klassifizierung ist für Schweizer Wanderwege bereits vollständig durch SchweizMobil und den SAC dokumentiert.

### Zusätzliche Filter
- Distanz (km) – min/max Slider
- Höhenmeter aufwärts / abwärts – min/max Slider
- Geschätzte Dauer – min/max
- Maximale Höhe (Gipfelhöhe) – Slider

### Filter-UI

```
┌──────────────────────────────────┐
│  🔍 Routen filtern               │
│                                  │
│  Schwierigkeit:                  │
│  [T1] [T2] [T3] [T4] [T5] [T6] │
│   ✓    ✓    ✓                    │
│                                  │
│  Distanz: 5 km ──●──── 25 km    │
│  Höhenmeter ↑: 0 ──●── 2000 hm  │
│  Dauer: 2h ──────●── 8h         │
│  Max. Höhe: 0 ───●── 4000m      │
│                                  │
│  [Filter anwenden] [Zurücksetzen]│
└──────────────────────────────────┘
```

### Filter-Query

```sql
SELECT r.*, 
       ST_AsGeoJSON(r.geom) as geojson
FROM routes r
WHERE r.is_published = true OR r.is_curated = true
  AND ($sacFilter IS NULL OR r.sac_scale = ANY($sacFilter))
  AND ($minDistance IS NULL OR r.distance_m >= $minDistance)
  AND ($maxDistance IS NULL OR r.distance_m <= $maxDistance)
  AND ($minElevation IS NULL OR r.elevation_gain_m >= $minElevation)
  AND ($maxElevation IS NULL OR r.elevation_gain_m <= $maxElevation)
  AND ($minDuration IS NULL OR r.estimated_duration_min >= $minDuration)
  AND ($maxDuration IS NULL OR r.estimated_duration_min <= $maxDuration)
  AND ($maxHeight IS NULL OR r.max_elevation_m <= $maxHeight)
ORDER BY r.created_at DESC
LIMIT 50;
```

### Filter-Persistenz
- Filter-Einstellungen bleiben gespeichert für die nächste Suche
- Gespeichert lokal (AsyncStorage oder Zustand)

---

## 3.7 GPX-Export/Import

### GPX-Export
- Einzelne Routen können als GPX-Datei exportiert werden
- Standard-Format für GPS-Tracks (kompatibel mit Garmin, Google Maps etc.)
- **GPX-Export ist ein Premium-Feature**

### Route veröffentlichen
- Nutzer kann aufgezeichnete Tour als Route veröffentlichen
- Route erscheint dann in der Routendatenbank
- Andere Nutzer können sie finden, speichern und nachwandern

---

## Akzeptanzkriterien – Dokument 3

### Karten
- [ ] MapLibre-Karte wird mit Swisstopo-Tiles angezeigt
- [ ] Karte zeigt aktuelle Position des Nutzers
- [ ] Karte ist scrollbar, zoombar, rotierbar
- [ ] Swisstopo-Wanderwege sind auf der Karte sichtbar

### Offline-Karten
- [ ] Karten nach Kanton oder Wandergebiet downloadbar
- [ ] Einzelne Kantone ca. 30–80 MB pro Region
- [ ] Mehrere Regionen gleichzeitig speicherbar
- [ ] Beim nächsten Online-Sein werden gespeicherte Regionen automatisch auf Wegänderungen geprüft und aktualisiert
- [ ] Nutzer sieht welche Regionen gespeichert sind und kann sie einzeln löschen
- [ ] App zeigt an wie viel Speicher belegt ist
- [ ] Nur für Premium-Abonnenten verfügbar

### Routing
- [ ] Routensuche: Nutzer kann Start und Ziel setzen, App berechnet Route über Wanderwegnetz
- [ ] Routenberechnung berücksichtigt SAC-Schwierigkeitsfilter des Nutzers
- [ ] Zwischenstopps können zur Route hinzugefügt werden
- [ ] Route wird auf der Karte als Linie eingezeichnet
- [ ] Route-Info-Panel zeigt Distanz, Höhenmeter, Dauer, SAC-Grad
- [ ] Höhenprofil wird für jede Route angezeigt

### Filter
- [ ] Filter nach SAC-Skala T1–T6, einzeln oder kombiniert wählbar
- [ ] Filter nach Distanz, Höhenmetern, Dauer und maximaler Höhe
- [ ] SAC-Schwierigkeitsgrad wird bei jeder Route prominent angezeigt
- [ ] Filter-Einstellungen bleiben gespeichert für die nächste Suche

### Routendatenbank
- [ ] Community-Routen: Aufgezeichnete Touren können als Route veröffentlicht werden
- [ ] Kuratierte Routen: 100+ handverlesene Routen zum Launch (Platzhalter-Struktur)
- [ ] Routen können gespeichert ("Merkliste") und offline verfügbar gemacht werden

### GPX
- [ ] GPX-Export einzelner Routen für Offline-Nutzung möglich (Premium)

---

## Relevante Tabellen (aus Dokument 01)

- `routes` – Routendaten
- `hiking_network` – Wanderweg-Netzwerk (pgRouting)
- `route_bookmarks` – Gespeicherte Routen (Merkliste)
- `recordings` – Tour-Aufzeichnungen (für Route-Veröffentlichung)
