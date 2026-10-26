// hooks/useSaveRoute.ts
// Speichert eine auf der Karte berechnete Route als eigene (nicht
// veröffentlichte) `routes`-Zeile und merkt sie vor, damit sie unter
// «Gespeicherte Routen» erscheint. Gibt die neue Routen-ID zurück (null, wenn
// es nicht geklappt hat). Ein zweiter Aufruf während des Speicherns tut nichts.

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildRouteInsertRow, saveRouteWithBookmark } from '../lib/routeRow';
import { queryKeys } from '../lib/queryKeys';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { useAuthStore } from '../stores/authStore';
import type { RouteResult } from './useRouting';

export function useSaveRoute() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveRoute = useCallback(
    async (result: RouteResult): Promise<string | null> => {
      if (!userId) {
        showErrorToast('Bitte melde dich an, um Routen zu speichern.');
        return null;
      }
      if (savingRef.current) return null;
      savingRef.current = true;
      setIsSaving(true);
      try {
        const routeId = await saveRouteWithBookmark(buildRouteInsertRow(result, userId), userId);
        void queryClient.invalidateQueries({ queryKey: queryKeys.posts.routeBookmarks(userId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.posts.savedRoutes(userId) });
        showSuccessToast('Route gespeichert. Du findest sie unter «Gespeicherte Routen».');
        return routeId;
      } catch (err) {
        console.error('[saveRoute] failed:', err);
        showErrorToast('Route konnte nicht gespeichert werden.');
        return null;
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [userId, queryClient],
  );

  return { saveRoute, isSaving };
}
