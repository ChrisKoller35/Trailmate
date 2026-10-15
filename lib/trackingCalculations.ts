import type { TrackPoint } from '../types';

const EARTH_RADIUS = 6371000; // meters
const ELEVATION_NOISE_THRESHOLD = 2; // meters

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

export function calculateTotalDistance(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  return total;
}

export function calculateElevation(points: TrackPoint[]): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].altitude;
    const curr = points[i].altitude;
    if (prev == null || curr == null) continue;

    const diff = curr - prev;
    if (Math.abs(diff) > ELEVATION_NOISE_THRESHOLD) {
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }
  }

  return { gain, loss };
}

export function calculateAvgSpeed(distanceM: number, movingTimeS: number): number {
  if (movingTimeS <= 0) return 0;
  return (distanceM / movingTimeS) * 3.6;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function applyTrailingDriftCorrection(points: TrackPoint[]): TrackPoint[] {
  if (points.length === 0) return points;

  const lastTimestamp = points[points.length - 1].timestamp;
  const twoMinutesMs = 2 * 60 * 1000;
  const cutoffTime = lastTimestamp - twoMinutesMs;

  // Walk backwards through the last 2 minutes. Keep everything up to the
  // last point where the user was still moving.
  let cutIndex = points.length;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].timestamp < cutoffTime) break;
    const speed = points[i].speed ?? 0;
    if (speed >= 0.3) {
      cutIndex = i + 1;
      break;
    }
    cutIndex = i;
  }

  return points.slice(0, cutIndex);
}
