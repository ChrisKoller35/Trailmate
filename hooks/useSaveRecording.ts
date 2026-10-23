// hooks/useSaveRecording.ts
// Speichert die aktuelle Aufzeichnung als `recordings`-Zeile, prüft danach
// Abzeichen und Challenges und setzt den Aufzeichnungs-Speicher zurück.
// Gibt die ID der neuen Aufzeichnung zurück (null, wenn es nicht geklappt hat).
// `isSaving` bleibt bis zum Ende des ganzen Ablaufs gesetzt, damit nichts
// doppelt gespeichert wird.

import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { checkAndAwardBadges, updateChallengeProgress } from '../lib/badgeEngine';
import { useAuthStore } from '../stores/authStore';
import { useRecordingStore } from '../stores/recordingStore';
import type { TrackPoint } from '../types';

export interface SaveRecordingInput {
  title: string;
  stats: {
    distance: number;
    elevationGain: number;
    elevationLoss: number;
    duration: number;
    avgSpeed: number;
    steps: number;
  };
  movingSeconds: number;
  startedAt: number | null;
  trackPoints: TrackPoint[];
}

export function useSaveRecording() {
  const userId = useAuthStore((s) => s.user?.id);
  const reset = useRecordingStore((s) => s.reset);

  const mutation = useMutation({
    mutationFn: async (input: SaveRecordingInput): Promise<string> => {
      if (!userId) throw new Error('not authenticated');
      const { stats, trackPoints } = input;

      const { data, error } = await supabase
        .from('recordings')
        .insert({
          user_id: userId,
          title: input.title.trim() || 'Unbenannte Tour',
          distance_m: Math.round(stats.distance),
          elevation_gain_m: Math.round(stats.elevationGain),
          elevation_loss_m: Math.round(stats.elevationLoss),
          duration_seconds: Math.round(stats.duration),
          moving_time_seconds: Math.round(input.movingSeconds),
          avg_speed_kmh: Math.round(stats.avgSpeed * 10) / 10,
          steps: stats.steps > 0 ? stats.steps : null,
          started_at: input.startedAt ? new Date(input.startedAt).toISOString() : null,
          finished_at: new Date().toISOString(),
          is_hidden: false,
          // Nur Länge und Breite: recordings.geom ist eine 2D-Spalte
          // (geometry(LineString, 4326)). Mit Höhe als dritter Zahl lehnt die
          // Datenbank die ganze Zeile ab («Geometry has Z dimension but column
          // does not»); die Höhenmeter stehen in eigenen Spalten.
          geom: trackPoints.length >= 2
            ? {
                type: 'LineString',
                coordinates: trackPoints.map((p) => [p.longitude, p.latitude]),
              }
            : null,
        })
        .select('id')
        .single();

      if (error) throw error;
      const recordingId = (data as { id?: string } | null)?.id;
      if (!recordingId) throw new Error('recording id missing');

      // Abzeichen und Challenges prüfen – ein Fehler hier ändert nichts daran,
      // dass die Tour gespeichert ist.
      let newBadges: string[] = [];
      try {
        newBadges = await checkAndAwardBadges(userId);
        await updateChallengeProgress(userId, stats);
      } catch {
        // Badge check failed silently - tour is still saved
      }

      if (newBadges.length > 0) {
        showSuccessToast(
          `🏆 Tour gespeichert! Du hast ${newBadges.length} neue${newBadges.length > 1 ? ' Abzeichen' : 's Abzeichen'} verdient!`,
        );
      } else {
        showSuccessToast('Deine Tour wurde erfolgreich gespeichert.');
      }
      reset();
      return recordingId;
    },
    onError: (err) => {
      console.error('[saveRecording] failed:', err);
    },
  });

  const saveRecording = async (input: SaveRecordingInput): Promise<string | null> => {
    if (!userId) {
      showErrorToast('Du musst angemeldet sein, um eine Tour zu speichern.');
      return null;
    }
    try {
      return await mutation.mutateAsync(input);
    } catch {
      showErrorToast('Die Tour konnte nicht gespeichert werden. Bitte versuche es erneut.');
      return null;
    }
  };

  return { saveRecording, isSaving: mutation.isPending };
}
