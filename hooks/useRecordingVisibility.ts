// hooks/useRecordingVisibility.ts
// Versteckt eine eigene Tour (recordings.is_hidden) oder zeigt sie wieder.
// Versteckte Touren sehen andere nicht (RLS recordings_select), und sie
// zählen nicht in den Profil-Zahlen; darum wird ['profile-stats', userId]
// nach einer Änderung neu geladen.
// `setHidden` gibt true zurück, wenn die Änderung gespeichert wurde.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { showErrorToast } from '../lib/toast';
import { useAuthStore } from '../stores/authStore';

export function useRecordingVisibility() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const setHidden = useCallback(
    async (recordingId: string, hidden: boolean): Promise<boolean> => {
      if (!userId) return false;

      const { error } = await supabase
        .from('recordings')
        .update({ is_hidden: hidden })
        .eq('id', recordingId)
        .eq('user_id', userId);

      if (error) {
        console.error('[useRecordingVisibility] update failed:', error);
        showErrorToast('Die Tour konnte nicht geändert werden.');
        return false;
      }

      await queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] });
      return true;
    },
    [userId, queryClient],
  );

  return { setHidden };
}
