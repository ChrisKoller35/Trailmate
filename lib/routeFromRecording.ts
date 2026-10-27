// lib/routeFromRecording.ts
// Baut aus einer eigenen Tour (recordings) eine veröffentlichte `routes`-Zeile.
// routes.geom ist 2D: recordingLineFeature liefert nur Länge und Breite.

import { recordingLineFeature } from './recordingLine';
import { regionFromCoordinates, type Region } from './regionFromCoordinates';
import { estimateDuration } from '../hooks/useRouting';

export interface RecordingRouteSource {
  title: string | null;
  started_at: string | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  geom: unknown;
}

export interface PublishedRouteRow {
  user_id: string;
  title: string;
  geom: { type: 'LineString'; coordinates: [number, number][] };
  distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_elevation_m: null;
  estimated_duration_min: number;
  sac_scale: null;
  region: Region | null;
  is_published: true;
  is_curated: false;
}

const MAX_TITLE_LENGTH = 200;

function fallbackTitle(startedAt: string | null): string {
  const date = startedAt ? new Date(startedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Eigene Tour';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `Tour vom ${dd}.${mm}.${date.getFullYear()}`;
}

export function buildRouteFromRecording(recording: RecordingRouteSource, userId: string): PublishedRouteRow {
  const line = recordingLineFeature(recording.geom);
  if (!line) throw new Error('Die Tour hat keine gültige Linie.');
  const coordinates = line.geometry.coordinates;
  const [startLng, startLat] = coordinates[0];

  const distance = recording.distance_m ?? 0;
  const gain = recording.elevation_gain_m ?? 0;
  const loss = recording.elevation_loss_m ?? 0;
  const title = recording.title?.trim() || fallbackTitle(recording.started_at);

  return {
    user_id: userId,
    title: title.slice(0, MAX_TITLE_LENGTH),
    geom: { type: 'LineString', coordinates },
    distance_m: distance,
    elevation_gain_m: gain,
    elevation_loss_m: loss,
    max_elevation_m: null,
    // routes.estimated_duration_min ist INTEGER
    estimated_duration_min: Math.round(estimateDuration(distance, gain, loss)),
    sac_scale: null,
    region: regionFromCoordinates(startLat, startLng),
    is_published: true,
    is_curated: false,
  };
}
