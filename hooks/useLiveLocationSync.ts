import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useRecordingStore } from '../stores/recordingStore';
import { useLiveTracking, useUpdateTrackingLocation } from './useLiveTracking';
import {
  initialLiveSyncState,
  isShareStillOpen,
  shouldSendLocation,
  type LiveSyncState,
} from '../lib/liveSyncThrottle';

// Prüft regelmässig, damit auch ohne neue Punkte nach Ablauf des Intervalls gesendet wird.
const CHECK_EVERY_MS = 30_000;

/**
 * Sendet während einer laufenden Aufzeichnung den letzten Track-Punkt an die
 * aktive Live-Tracking-Sitzung, höchstens alle `update_interval_minutes`
 * (mindestens 1 Minute), sofort beim Start und beim Zurückkehren in die App.
 * Nur im Vordergrund; Senden bei gesperrtem Telefon ist nicht Teil davon.
 */
export function useLiveLocationSync(): { isSharing: boolean } {
  const { data: session } = useLiveTracking();
  const status = useRecordingStore((s) => s.status);
  const lastPoint = useRecordingStore((s) => s.trackPoints[s.trackPoints.length - 1]);
  const { mutate: sendLocation } = useUpdateTrackingLocation();

  const [now, setNow] = useState(() => Date.now());
  const syncState = useRef<LiveSyncState>(initialLiveSyncState);
  const syncedSessionId = useRef<string | null>(null);

  const isRecording = status === 'recording' || status === 'paused';
  const isSharing =
    !!session?.is_active && isRecording && isShareStillOpen(session.started_at, now);
  const sessionId = isSharing ? session!.id : null;
  const intervalMinutes = session?.update_interval_minutes;

  const trySend = useCallback(
    (force: boolean) => {
      if (!sessionId || !lastPoint) return;
      if (syncedSessionId.current !== sessionId) {
        syncedSessionId.current = sessionId;
        syncState.current = initialLiveSyncState;
      }
      const at = Date.now();
      const send = shouldSendLocation({
        now: at,
        pointTime: lastPoint.timestamp,
        state: syncState.current,
        updateIntervalMinutes: intervalMinutes,
        force,
      });
      if (!send) return;
      syncState.current = { lastSentAt: at, lastSentPointTime: lastPoint.timestamp };
      sendLocation({
        sessionId,
        location: { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
      });
    },
    [sessionId, lastPoint, intervalMinutes, sendLocation],
  );

  // Neuer Punkt oder Takt: senden, wenn das Intervall um ist (erster Punkt sofort)
  useEffect(() => {
    trySend(false);
  }, [trySend, now]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => setNow(Date.now()), CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [sessionId]);

  // Zurück in der App: sofort den neuesten Punkt senden
  const trySendRef = useRef(trySend);
  useEffect(() => {
    trySendRef.current = trySend;
  }, [trySend]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setNow(Date.now());
        trySendRef.current(true);
      }
    });
    return () => sub.remove();
  }, []);

  return { isSharing };
}
