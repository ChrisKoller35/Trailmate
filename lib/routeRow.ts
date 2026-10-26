// lib/routeRow.ts
// Baut aus einer berechneten Route (useRouting) eine `routes`-Zeile und
// speichert sie zusammen mit dem Merklisten-Eintrag (`route_bookmarks`).

import { supabase } from './supabase';
import type { RouteResult } from '../hooks/useRouting';

export interface RouteInsertRow {
  user_id: string;
  title: string;
  geom: { type: 'LineString'; coordinates: [number, number][] };
  distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_elevation_m: number | null;
  estimated_duration_min: number;
  sac_scale: RouteResult['sac_scale'];
  is_published: false;
  is_curated: false;
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

export function buildRouteInsertRow(
  result: RouteResult,
  userId: string,
  now: Date = new Date(),
): RouteInsertRow {
  const line = result.geojson.features.find((f) => f.geometry?.type === 'LineString');
  // Nur Länge und Breite: routes.geom ist eine 2D-Spalte (geometry(LineString,
  // 4326)); mit Höhe als dritter Zahl lehnt die Datenbank die Zeile ab.
  const coordinates: [number, number][] = [];
  if (line && line.geometry.type === 'LineString') {
    for (const [lng, lat] of line.geometry.coordinates) {
      if (Number.isFinite(lng) && Number.isFinite(lat)) coordinates.push([lng, lat]);
    }
  }
  if (coordinates.length < 2) throw new Error('Route hat keine gültige Linie.');

  return {
    user_id: userId,
    title: `Eigene Route, ${formatDate(now)}`,
    geom: { type: 'LineString', coordinates },
    distance_m: result.distance_m,
    elevation_gain_m: result.elevation_gain_m,
    elevation_loss_m: result.elevation_loss_m,
    max_elevation_m: result.max_elevation_m,
    // routes.estimated_duration_min ist INTEGER
    estimated_duration_min: Math.round(result.estimated_duration_min),
    sac_scale: result.sac_scale,
    is_published: false,
    is_curated: false,
  };
}

// Legt die Route an und merkt sie vor. Schlägt das Merken fehl, wird die Route
// wieder gelöscht, damit keine verwaisten Routen entstehen.
export async function saveRouteWithBookmark(row: RouteInsertRow, userId: string): Promise<string> {
  const { data, error } = await supabase.from('routes').insert(row).select('id').single();
  if (error) throw error;
  const routeId = (data as { id?: string } | null)?.id;
  if (!routeId) throw new Error('route id missing');

  const { error: bookmarkError } = await supabase
    .from('route_bookmarks')
    .insert({ user_id: userId, route_id: routeId });
  if (bookmarkError) {
    await supabase.from('routes').delete().eq('id', routeId);
    throw bookmarkError;
  }
  return routeId;
}
