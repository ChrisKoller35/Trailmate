import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  applyRouteFilters,
  DEFAULT_ROUTE_FILTERS,
  type RouteFilterValues,
} from '../lib/routeFilterQuery';
import { DEMO_ROUTES } from '../__fixtures__/demoData';
import type { Route, SACScale } from '../types';

interface RouteFilterState extends RouteFilterValues {
  toggleSacScale: (scale: SACScale) => void;
  setMinDistance: (val: number) => void;
  setMaxDistance: (val: number) => void;
  setMinElevation: (val: number) => void;
  setMaxElevation: (val: number) => void;
  setMinDuration: (val: number) => void;
  setMaxDuration: (val: number) => void;
  setMaxHeight: (val: number) => void;
  resetFilters: () => void;
}

const LOAD_ERROR = 'Routen konnten nicht geladen werden.';

export const useRouteFilterStore = create<RouteFilterState>()(
  persist(
    (set) => ({
      // persist mischt flach: alte Stände ohne min*-Felder behalten die Standardwerte
      ...DEFAULT_ROUTE_FILTERS,
      toggleSacScale: (scale) =>
        set((state) => ({
          sacScales: state.sacScales.includes(scale)
            ? state.sacScales.filter((s) => s !== scale)
            : [...state.sacScales, scale],
        })),
      setMinDistance: (v) => set((s) => ({ minDistance: Math.min(v, s.maxDistance) })),
      setMaxDistance: (v) => set((s) => ({ maxDistance: Math.max(v, s.minDistance) })),
      setMinElevation: (v) => set((s) => ({ minElevation: Math.min(v, s.maxElevation) })),
      setMaxElevation: (v) => set((s) => ({ maxElevation: Math.max(v, s.minElevation) })),
      setMinDuration: (v) => set((s) => ({ minDuration: Math.min(v, s.maxDuration) })),
      setMaxDuration: (v) => set((s) => ({ maxDuration: Math.max(v, s.minDuration) })),
      setMaxHeight: (maxHeight) => set({ maxHeight }),
      resetFilters: () => set(DEFAULT_ROUTE_FILTERS),
    }),
    {
      name: 'trailmate-route-filters',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function useRouteFilter() {
  const filters = useRouteFilterStore();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchFilteredRoutes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Aktuellen Stand direkt aus dem Store lesen, damit kein veralteter Filter greift
      const base = supabase.from('routes').select('*');
      const query = applyRouteFilters<typeof base>(base, useRouteFilterStore.getState())
        .order('created_at', { ascending: false })
        .limit(50);

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;
      const fetched = (data as Route[]) ?? [];
      // Demo-Routen nur in der Entwicklung, nie im fertigen Build
      const useDemo = __DEV__ && fetched.length === 0;
      setRoutes(useDemo ? DEMO_ROUTES : fetched);
      setIsDemo(useDemo);
    } catch (err) {
      console.error('Failed to fetch filtered routes:', err);
      setRoutes(__DEV__ ? DEMO_ROUTES : []);
      setIsDemo(__DEV__);
      if (!__DEV__) setError(LOAD_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    ...filters,
    routes,
    isLoading,
    error,
    isDemo,
    fetchFilteredRoutes,
  };
}
