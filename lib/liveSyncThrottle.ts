// Takt für das Senden des Live-Standorts (hooks/useLiveLocationSync).
// Reine Funktionen, damit der Takt ohne React und ohne Netz testbar ist.

/** Kürzester erlaubter Abstand zwischen zwei Sendungen. */
export const MIN_SYNC_INTERVAL_MINUTES = 1;

/** Nach dieser Zeit liefert get_live_tracking_by_token nichts mehr (Migration 021). */
export const SHARE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export function syncIntervalMs(updateIntervalMinutes: number | null | undefined): number {
  const minutes =
    typeof updateIntervalMinutes === 'number' && Number.isFinite(updateIntervalMinutes)
      ? updateIntervalMinutes
      : MIN_SYNC_INTERVAL_MINUTES;
  return Math.max(MIN_SYNC_INTERVAL_MINUTES, minutes) * 60_000;
}

export interface LiveSyncState {
  /** Zeitpunkt der letzten Sendung (ms) oder null, wenn noch nichts gesendet wurde */
  lastSentAt: number | null;
  /** timestamp des zuletzt gesendeten Track-Punkts */
  lastSentPointTime: number | null;
}

export const initialLiveSyncState: LiveSyncState = { lastSentAt: null, lastSentPointTime: null };

/**
 * Soll der Punkt mit `pointTime` jetzt gesendet werden?
 * - ohne Punkt oder ohne neuen Punkt nie
 * - der erste Punkt einer Sitzung sofort
 * - `force` (z. B. Rückkehr in die App) sofort, sofern der Punkt neu ist
 * - sonst erst, wenn das Intervall der Sitzung (mindestens 1 Minute) um ist
 */
export function shouldSendLocation(params: {
  now: number;
  pointTime: number | null | undefined;
  state: LiveSyncState;
  updateIntervalMinutes: number | null | undefined;
  force?: boolean;
}): boolean {
  const { now, pointTime, state, updateIntervalMinutes, force } = params;
  if (pointTime == null) return false;
  if (state.lastSentPointTime != null && pointTime <= state.lastSentPointTime) return false;
  if (state.lastSentAt == null || force) return true;
  return now - state.lastSentAt >= syncIntervalMs(updateIntervalMinutes);
}

/** Ist die Sitzung jung genug, dass der geteilte Link noch etwas anzeigt? */
export function isShareStillOpen(startedAt: string | null | undefined, now: number): boolean {
  if (!startedAt) return true;
  const started = Date.parse(startedAt);
  return Number.isNaN(started) || now - started < SHARE_MAX_AGE_MS;
}
