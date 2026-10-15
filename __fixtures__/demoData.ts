/**
 * Demo/Fallback data for testing the app without a fully configured backend.
 * Provides sample routes and route results so the map, explore, and route-detail
 * screens are functional even when Supabase Edge Functions / pgRouting are unavailable.
 */

import type { Route, SACScale } from '../types';
import type { FeatureCollection, Feature, LineString } from 'geojson';

// ─── Demo route GeoJSON: Grindelwald-First Rundweg ───────

const DEMO_ROUTE_COORDINATES: [number, number][] = [
  [8.0413, 46.6244],
  [8.0425, 46.6260],
  [8.0440, 46.6278],
  [8.0458, 46.6295],
  [8.0480, 46.6310],
  [8.0502, 46.6325],
  [8.0528, 46.6338],
  [8.0555, 46.6350],
  [8.0580, 46.6362],
  [8.0608, 46.6370],
  [8.0635, 46.6378],
  [8.0660, 46.6390],
  [8.0685, 46.6405],
  [8.0705, 46.6420],
  [8.0720, 46.6435],
  [8.0730, 46.6452],
  [8.0735, 46.6470],
  [8.0730, 46.6488],
  [8.0718, 46.6502],
  [8.0700, 46.6515],
  [8.0678, 46.6525],
  [8.0655, 46.6530],
  [8.0630, 46.6528],
  [8.0608, 46.6520],
  [8.0590, 46.6508],
  [8.0575, 46.6492],
  [8.0562, 46.6475],
  [8.0550, 46.6458],
  [8.0535, 46.6440],
  [8.0518, 46.6425],
  [8.0498, 46.6410],
  [8.0475, 46.6395],
  [8.0452, 46.6380],
  [8.0430, 46.6362],
  [8.0418, 46.6345],
  [8.0412, 46.6328],
  [8.0408, 46.6310],
  [8.0405, 46.6292],
  [8.0405, 46.6275],
  [8.0408, 46.6258],
  [8.0413, 46.6244],
];

const DEMO_ELEVATION_PROFILE = [
  { distance: 0, elevation: 1050 },
  { distance: 0.3, elevation: 1120 },
  { distance: 0.6, elevation: 1210 },
  { distance: 0.9, elevation: 1320 },
  { distance: 1.2, elevation: 1440 },
  { distance: 1.5, elevation: 1550 },
  { distance: 1.8, elevation: 1680 },
  { distance: 2.1, elevation: 1790 },
  { distance: 2.4, elevation: 1880 },
  { distance: 2.7, elevation: 1960 },
  { distance: 3.0, elevation: 2040 },
  { distance: 3.3, elevation: 2120 },
  { distance: 3.6, elevation: 2180 },
  { distance: 3.9, elevation: 2230 },
  { distance: 4.2, elevation: 2260 },
  { distance: 4.5, elevation: 2270 },
  { distance: 4.8, elevation: 2250 },
  { distance: 5.1, elevation: 2210 },
  { distance: 5.4, elevation: 2150 },
  { distance: 5.7, elevation: 2080 },
  { distance: 6.0, elevation: 2000 },
  { distance: 6.3, elevation: 1920 },
  { distance: 6.6, elevation: 1840 },
  { distance: 6.9, elevation: 1750 },
  { distance: 7.2, elevation: 1660 },
  { distance: 7.5, elevation: 1570 },
  { distance: 7.8, elevation: 1470 },
  { distance: 8.1, elevation: 1370 },
  { distance: 8.4, elevation: 1260 },
  { distance: 8.7, elevation: 1150 },
  { distance: 9.0, elevation: 1050 },
];

export const DEMO_ROUTE_GEOJSON: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: DEMO_ROUTE_COORDINATES,
      },
    } as Feature<LineString>,
  ],
};

export interface DemoRouteResult {
  geojson: FeatureCollection<LineString>;
  distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  estimated_duration_min: number;
  sac_scale: SACScale | null;
  max_elevation_m: number | null;
  elevationProfile: { distance: number; elevation: number }[];
}

export const DEMO_ROUTE_RESULT: DemoRouteResult = {
  geojson: DEMO_ROUTE_GEOJSON,
  distance_m: 9000,
  elevation_gain_m: 1220,
  elevation_loss_m: 1220,
  estimated_duration_min: 255,
  sac_scale: 'T2' as SACScale,
  max_elevation_m: 2270,
  elevationProfile: DEMO_ELEVATION_PROFILE,
};

// ─── Demo routes for the Explore list ───────────────────

export const DEMO_ROUTES: Route[] = [
  {
    id: 'demo-1',
    user_id: null,
    title: 'Grindelwald-First Rundweg',
    description:
      'Aussichtsreiche Rundwanderung über die First mit Blick auf Eiger, Mönch und Jungfrau. Gut markierte Bergwege.',
    gpx_url: null,
    distance_m: 9000,
    elevation_gain_m: 1220,
    elevation_loss_m: 1220,
    max_elevation_m: 2270,
    estimated_duration_min: 255,
    sac_scale: 'T2' as SACScale,
    is_published: true,
    is_curated: true,
    region: 'Berner Oberland',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    user_id: null,
    title: 'Oeschinensee Panoramaweg',
    description:
      'Gemütliche Wanderung rund um den Oeschinensee bei Kandersteg. Türkisblaues Wasser und imposante Felswände.',
    gpx_url: null,
    distance_m: 5400,
    elevation_gain_m: 320,
    elevation_loss_m: 320,
    max_elevation_m: 1650,
    estimated_duration_min: 120,
    sac_scale: 'T1' as SACScale,
    is_published: true,
    is_curated: true,
    region: 'Berner Oberland',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    user_id: null,
    title: 'Pilatus Tomlishorn',
    description:
      'Alpine Gratwanderung vom Pilatus Kulm zum Tomlishorn. Spektakuläre Tiefblicke auf den Vierwaldstättersee.',
    gpx_url: null,
    distance_m: 3200,
    elevation_gain_m: 180,
    elevation_loss_m: 180,
    max_elevation_m: 2132,
    estimated_duration_min: 75,
    sac_scale: 'T3' as SACScale,
    is_published: true,
    is_curated: false,
    region: 'Zentralschweiz',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-4',
    user_id: null,
    title: 'Creux du Van Rundwanderung',
    description:
      'Wanderung zum imposanten Felskessel Creux du Van im Neuenburger Jura. Steinböcke oft sichtbar.',
    gpx_url: null,
    distance_m: 14000,
    elevation_gain_m: 750,
    elevation_loss_m: 750,
    max_elevation_m: 1465,
    estimated_duration_min: 300,
    sac_scale: 'T2' as SACScale,
    is_published: true,
    is_curated: true,
    region: 'Jura & Drei-Seen-Land',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-5',
    user_id: null,
    title: 'Aletschgletscher Panoramaweg',
    description:
      'Höhenweg entlang des grössten Alpengletschers. UNESCO-Welterbe mit einmaliger Gletschersicht.',
    gpx_url: null,
    distance_m: 11500,
    elevation_gain_m: 480,
    elevation_loss_m: 620,
    max_elevation_m: 2342,
    estimated_duration_min: 240,
    sac_scale: 'T2' as SACScale,
    is_published: true,
    is_curated: true,
    region: 'Wallis',
    created_at: new Date().toISOString(),
  },
];
