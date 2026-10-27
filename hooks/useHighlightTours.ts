// hooks/useHighlightTours.ts
// Highlight-Touren im eigenen Profil auswählen und speichern (highlight_tours).
// Der Editor lädt die 100 neusten sichtbaren Touren und die gespeicherte
// Auswahl; versteckte Touren fallen aus der Auswahl. Gespeichert wird erst mit
// upsert (sort_order = Position), danach werden die übrigen Zeilen gelöscht.

import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { showErrorToast } from '../lib/toast';
import { useAuthStore } from '../stores/authStore';

export interface HighlightTourOption {
  id: string;
  title: string | null;
  started_at: string;
  distance_m: number | null;
}

interface HighlightRow {
  recording_id: string;
  sort_order: number;
  recordings: (HighlightTourOption & { is_hidden: boolean }) | null;
}

export function useHighlightEditor() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['highlight-editor', userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ tours: HighlightTourOption[]; selected: string[] }> => {
      const [toursRes, highlightsRes] = await Promise.all([
        supabase
          .from('recordings')
          .select('id, title, started_at, distance_m')
          .eq('user_id', userId as string)
          .eq('is_hidden', false)
          .order('started_at', { ascending: false })
          .limit(100),
        supabase
          .from('highlight_tours')
          .select('recording_id, sort_order, recordings(id, title, started_at, distance_m, is_hidden)')
          .eq('user_id', userId as string)
          .order('sort_order'),
      ]);
      if (toursRes.error) throw toursRes.error;
      if (highlightsRes.error) throw highlightsRes.error;

      const tours = (toursRes.data ?? []) as HighlightTourOption[];
      const selected: string[] = [];
      for (const row of (highlightsRes.data ?? []) as unknown as HighlightRow[]) {
        const rec = row.recordings;
        if (!rec || rec.is_hidden) continue;
        selected.push(rec.id);
        if (!tours.some((t) => t.id === rec.id)) {
          tours.push({ id: rec.id, title: rec.title, started_at: rec.started_at, distance_m: rec.distance_m });
        }
      }
      return { tours, selected };
    },
  });
}

export function useSaveHighlights() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const saveHighlights = useCallback(
    async (selected: string[]): Promise<boolean> => {
      if (!userId || savingRef.current) return false;
      savingRef.current = true;
      setIsSaving(true);
      try {
        if (selected.length > 0) {
          const rows = selected.map((recording_id, sort_order) => ({ user_id: userId, recording_id, sort_order }));
          const { error } = await supabase
            .from('highlight_tours')
            .upsert(rows, { onConflict: 'user_id,recording_id' });
          if (error) throw error;
        }
        let del = supabase.from('highlight_tours').delete().eq('user_id', userId);
        if (selected.length > 0) del = del.not('recording_id', 'in', `(${selected.join(',')})`);
        const { error } = await del;
        if (error) throw error;

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['highlight-tours', userId] }),
          queryClient.invalidateQueries({ queryKey: ['highlight-editor', userId] }),
        ]);
        return true;
      } catch (error) {
        console.error('[useSaveHighlights] save failed:', error);
        showErrorToast('Die Highlight-Touren konnten nicht gespeichert werden.');
        return false;
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [userId, queryClient],
  );

  return { saveHighlights, isSaving };
}
