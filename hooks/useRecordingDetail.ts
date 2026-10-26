// hooks/useRecordingDetail.ts
// Eine eigene Tour mit Linie (geom) laden und löschen. Gelesen und gelöscht
// wird nur mit Filter auf user_id; eine fremde Tour ergibt null.

import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { showErrorToast } from '../lib/toast';
import { useAuthStore } from '../stores/authStore';
import type { Recording } from '../types';

export type RecordingDetail = Omit<Recording, 'user_id' | 'route_id' | 'gpx_url' | 'finished_at'> & {
  geom: unknown;
};

export function useRecordingDetail(id: string | null) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['recording', id],
    enabled: !!id && !!userId,
    queryFn: async (): Promise<RecordingDetail | null> => {
      const { data, error } = await supabase
        .from('recordings')
        .select('id, title, started_at, distance_m, elevation_gain_m, elevation_loss_m, duration_seconds, moving_time_seconds, avg_speed_kmh, steps, is_hidden, geom')
        .eq('id', id as string)
        .eq('user_id', userId as string)
        .maybeSingle();
      if (error) throw error;
      return (data as RecordingDetail | null) ?? null;
    },
  });
}

export function useDeleteRecording() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingRef = useRef(false);

  const deleteRecording = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId || deletingRef.current) return false;
      deletingRef.current = true;
      setIsDeleting(true);
      try {
        const { error } = await supabase.from('recordings').delete().eq('id', id).eq('user_id', userId);
        if (error) {
          console.error('[useDeleteRecording] delete failed:', error);
          showErrorToast('Die Tour konnte nicht gelöscht werden.');
          return false;
        }
        await queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] });
        return true;
      } finally {
        deletingRef.current = false;
        setIsDeleting(false);
      }
    },
    [userId, queryClient],
  );

  return { deleteRecording, isDeleting };
}
