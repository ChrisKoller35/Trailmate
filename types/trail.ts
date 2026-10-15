// ─── Trail & Route Domain ──────────────────────────────────

import type { GeoPoint } from './common';

export type SACScale = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export interface Route {
  id: string;
  user_id: string | null;
  title: string | null;
  description: string | null;
  gpx_url: string | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  max_elevation_m: number | null;
  estimated_duration_min: number | null;
  sac_scale: SACScale | null;
  is_published: boolean;
  is_curated: boolean;
  region: string | null;
  created_at: string;
}

export interface HikingNetwork {
  id: number;
  source: number | null;
  target: number | null;
  length_m: number | null;
  elevation_gain: number | null;
  elevation_loss: number | null;
  sac_scale: SACScale | null;
  surface: string | null;
  cost: number | null;
}

export interface WeatherForecast {
  id: number;
  station_id: string | null;
  location: GeoPoint | null;
  station_elevation_m: number | null;
  forecast_time: string | null;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  cloud_cover: number | null;
  weather_symbol_code: string | null;
  source: 'meteoswiss' | 'yrno';
  updated_at: string;
}

export interface TrailCondition {
  id: string;
  route_id: string | null;
  user_id: string | null;
  reported_at: string;
  conditions: Record<string, unknown> | null;
  snow_line_meters: number | null;
  comment: string | null;
  photo_urls: string[] | null;
  location: GeoPoint | null;
  helpfulness_score: number;
  expires_at: string | null;
}

export type TrailConditionKey =
  | 'trail_open'
  | 'snow_fields'
  | 'wet_slippery'
  | 'rockfall_danger'
  | 'partially_closed'
  | 'bridge_damaged';

export interface TrailConditionCategories {
  trail_open?: boolean;
  snow_fields?: boolean;
  wet_slippery?: boolean;
  rockfall_danger?: boolean;
  partially_closed?: boolean;
  bridge_damaged?: boolean;
}
