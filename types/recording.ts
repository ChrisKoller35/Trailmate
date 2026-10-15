// ─── Recording & Tracking Domain ──────────────────────────

import type { GeoPoint } from './common';

export interface Recording {
  id: string;
  user_id: string;
  route_id: string | null;
  title: string | null;
  gpx_url: string | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  duration_seconds: number | null;
  moving_time_seconds: number | null;
  avg_speed_kmh: number | null;
  steps: number | null;
  started_at: string | null;
  finished_at: string | null;
  is_hidden: boolean;
}

export interface TrackPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
  speed: number | null;
  accuracy: number | null;
  isPause?: boolean;
}

export interface LiveTrackingSession {
  id: string;
  user_id: string;
  share_token: string;
  trusted_contacts: Array<{ name: string; phone?: string; email?: string }> | null;
  expected_return: string | null;
  update_interval_minutes: number;
  last_location: GeoPoint | null;
  last_updated_at: string | null;
  is_active: boolean;
  started_at: string;
}
