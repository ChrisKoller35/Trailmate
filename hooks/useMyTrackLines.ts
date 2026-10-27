// hooks/useMyTrackLines.ts
// Linien der eigenen letzten 50 Touren für die Karte in der Statistik. Lädt
// erst, wenn enabled (nach einem Tipp), weil 50 Linien über 1 MB sein können.
// Versteckte Touren zählen mit; die Karte sieht nur man selbst.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { buildTrackCollection, type TrackCollection } from '../lib/trackCollection';
import { useAuthStore } from '../stores/authStore';

export function useMyTrackLines(enabled: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['my-track-lines', userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<TrackCollection> => {
      const { data, error } = await supabase
        .from('recordings')
        .select('id, geom')
        .eq('user_id', userId as string)
        .not('geom', 'is', null)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return buildTrackCollection((data ?? []) as { id: string; geom: unknown }[]);
    },
  });
}
