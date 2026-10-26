import type { TrackPoint } from '../types';

const EARTH_RADIUS = 6371000; // meters
const ELEVATION_NOISE_THRESHOLD = 2; // meters
const AUTO_PAUSE_MIN_SECONDS = 60;
const AUTO_PAUSE_MAX_SPEED = 0.3; // m/s

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

// Während einer manuellen Pause nimmt der Tracking-Service keine Punkte an.
// Ein Schritt über eine abgeschlossene Pause (z. B. Bahnfahrt) ist darum keine
// Wanderstrecke.
export function spansManualPause(t0: number, t1: number, manualPauses: ManualPause[]): boolean {
  return manualPauses.some((p) => p.end !== null && t0 <= p.start && t1 >= p.end);
}

export function calculateTotalDistance(
  points: TrackPoint[],
  manualPauses: ManualPause[] = []
): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    if (spansManualPause(points[i - 1].timestamp, points[i].timestamp, manualPauses)) continue;
    total += calculateDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  return total;
}

export function calculateElevation(
  points: TrackPoint[],
  manualPauses: ManualPause[] = []
): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;

  for (let i = 1; i < points.length; i++) {
    if (spansManualPause(points[i - 1].timestamp, points[i].timestamp, manualPauses)) continue;
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

export interface ManualPause {
  start: number;
  end: number | null;
}

// Stillstand zeigt sich als lange Zeitlücke zwischen zwei nahen Punkten, weil
// der Tracking-Service Punkte unter 10 m Abstand verwirft. Zeit, die in eine
// manuelle Pause fällt, wird nicht gezählt, damit nichts doppelt abgezogen wird.
export function calculateAutoPauseSeconds(
  points: TrackPoint[],
  manualPauses: ManualPause[] = []
): number {
  if (points.length < 2) return 0;
  const lastTimestamp = points[points.length - 1].timestamp;

  let pauseMs = 0;
  for (let i = 1; i < points.length; i++) {
    const t0 = points[i - 1].timestamp;
    const t1 = points[i].timestamp;
    const durationMs = t1 - t0;
    if (durationMs <= 0 || durationMs < AUTO_PAUSE_MIN_SECONDS * 1000) continue;

    const distance = calculateDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
    if (distance / (durationMs / 1000) >= AUTO_PAUSE_MAX_SPEED) continue;

    let overlapMs = 0;
    for (const pause of manualPauses) {
      const end = pause.end ?? lastTimestamp;
      overlapMs += Math.max(0, Math.min(t1, end) - Math.max(t0, pause.start));
    }
    pauseMs += Math.max(0, durationMs - overlapMs);
  }

  return pauseMs / 1000;
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
