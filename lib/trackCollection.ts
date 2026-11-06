// lib/trackCollection.ts
// Mehrere recordings.geom als FeatureCollection für die Karte. Ungültige
// Linien fallen weg; jede Linie wird ausgedünnt (erster und letzter Punkt
// bleiben, dazwischen nur Punkte mit mindestens minStepM Metern Abstand zum
// zuletzt behaltenen), damit 50 Touren die Karte nicht ausbremsen.

import { recordingLineFeature } from './recordingLine';
import { lineBounds } from './geoBounds';
import { calculateDistance } from './trackingCalculations';

export interface TrackFeature {
  type: 'Feature';
  properties: { id: string };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

export interface TrackCollection {
  collection: { type: 'FeatureCollection'; features: TrackFeature[] };
  bounds: { ne: [number, number]; sw: [number, number] } | null;
  count: number;
}

function thin(points: [number, number][], minStepM: number): [number, number][] {
  const kept: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [lng, lat] = points[i];
    const [lastLng, lastLat] = kept[kept.length - 1];
    if (calculateDistance(lastLat, lastLng, lat, lng) >= minStepM) kept.push(points[i]);
  }
  kept.push(points[points.length - 1]);
  return kept;
}

export function buildTrackCollection(
  rows: { id: string; geom: unknown }[],
  minStepM = 25,
): TrackCollection {
  const features: TrackFeature[] = [];
  // Grenzen je Linie aus allen Punkten (vor dem Ausdünnen), dann vereinigt.
  const corners: [number, number][] = [];
  for (const row of rows) {
    const line = recordingLineFeature(row.geom);
    if (!line) continue;
    const coordinates = thin(line.geometry.coordinates, minStepM);
    features.push({ type: 'Feature', properties: { id: row.id }, geometry: { type: 'LineString', coordinates } });
    const b = lineBounds(line.geometry.coordinates);
    if (b) corners.push(b.ne, b.sw);
  }
  return {
    collection: { type: 'FeatureCollection', features },
    bounds: lineBounds(corners),
    count: features.length,
  };
}
