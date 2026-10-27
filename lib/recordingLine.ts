// lib/recordingLine.ts
// recordings.geom (GeoJSON-Objekt oder JSON-Text) als LineString-Feature für
// die Karte. `crs` und Höhe werden ignoriert, ungültige Punkte verworfen;
// unter 2 Punkten gibt es null.

export function recordingLineFeature(geom: unknown): {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
} | null {
  let value = geom;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const { type, coordinates } = (value ?? {}) as { type?: unknown; coordinates?: unknown };
  if (type !== 'LineString' || !Array.isArray(coordinates)) return null;

  const points: [number, number][] = [];
  for (const point of coordinates) {
    const [lng, lat] = Array.isArray(point) ? point : [];
    if (Number.isFinite(lng) && Number.isFinite(lat)) points.push([lng, lat]);
  }
  if (points.length < 2) return null;
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } };
}
