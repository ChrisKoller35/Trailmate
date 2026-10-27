// hooks/usePublishRecording.ts
// Veröffentlicht eine eigene Tour als Route: legt die `routes`-Zeile an und
// setzt recordings.route_id auf sie. Scheitert das Setzen, wird die Route
// wieder gelöscht (wie saveRouteWithBookmark), damit die Tour nicht doppelt
// veröffentlicht werden kann und keine verwaisten Routen entstehen.
// `publishRecording` gibt die Routen-ID zurück, bei Fehlern null.

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { buildRouteFromRecording, type RecordingRouteSource } from '../lib/routeFromRecording';
import { useAuthStore } from '../stores/authStore';

export function usePublishRecording() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [isPublishing, setIsPublishing] = useState(false);
  const publishingRef = useRef(false);

  const publishRecording = useCallback(
    async (recording: { id: string } & RecordingRouteSource): Promise<string | null> => {
      if (!userId || publishingRef.current) return null;
      publishingRef.current = true;
      setIsPublishing(true);
      try {
        const row = buildRouteFromRecording(recording, userId);
        const { data, error } = await supabase.from('routes').insert(row).select('id').single();
        if (error) throw error;
        const routeId = (data as { id?: string } | null)?.id;
        if (!routeId) throw new Error('route id missing');

        const { error: linkError } = await supabase
          .from('recordings')
          .update({ route_id: routeId })
          .eq('id', recording.id)
          .eq('user_id', userId);
        if (linkError) {
          await supabase.from('routes').delete().eq('id', routeId);
          throw linkError;
        }

        await queryClient.invalidateQueries({ queryKey: ['recording', recording.id] });
        showSuccessToast('Route veröffentlicht. Andere finden sie jetzt in Entdecken.');
        return routeId;
      } catch (error) {
        console.error('[usePublishRecording] publish failed:', error);
        showErrorToast('Die Tour konnte nicht veröffentlicht werden.');
        return null;
      } finally {
        publishingRef.current = false;
        setIsPublishing(false);
      }
    },
    [userId, queryClient],
  );

  return { publishRecording, isPublishing };
}
