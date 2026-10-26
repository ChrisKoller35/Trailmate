// lib/recordingLine.ts
// Macht aus recordings.geom (GeoJSON-Objekt von PostgREST oder derselbe
// Inhalt als JSON-Text) ein LineString-Feature für die Karte. `crs` und eine
// Höhe als dritte Zahl werden ignoriert, ungültige Punkte verworfen; unter
// 2 Punkten gibt es null.

export interface RecordingLineFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

export function recordingLineFeature(geom: unknown): RecordingLineFeature | null {
  let value = geom;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown };
  if (type !== 'LineString' || !Array.isArray(coordinates)) return null;

  const points: [number, number][] = [];
  for (const point of coordinates) {
    if (!Array.isArray(point)) continue;
    const [lng, lat] = point;
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    points.push([lng, lat]);
  }
  if (points.length < 2) return null;

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: points },
  };
}
