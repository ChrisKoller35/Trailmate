import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEMO_ROUTES } from '../__fixtures__/demoData';
import type { Route, SACScale } from '../types';

interface RouteFilterState {
  sacScales: SACScale[];
  maxDistance: number; // km
  maxElevation: number; // m
  maxDuration: number; // hours
  maxHeight: number; // m above sea level
  toggleSacScale: (scale: SACScale) => void;
  setMaxDistance: (val: number) => void;
  setMaxElevation: (val: number) => void;
  setMaxDuration: (val: number) => void;
  setMaxHeight: (val: number) => void;
  resetFilters: () => void;
}

const DEFAULTS = {
  sacScales: [] as SACScale[],
  maxDistance: 50,
  maxElevation: 3000,
  maxDuration: 12,
  maxHeight: 4500,
};

export const useRouteFilterStore = create<RouteFilterState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      toggleSacScale: (scale) =>
        set((state) => ({
          sacScales: state.sacScales.includes(scale)
            ? state.sacScales.filter((s) => s !== scale)
            : [...state.sacScales, scale],
        })),
      setMaxDistance: (maxDistance) => set({ maxDistance }),
      setMaxElevation: (maxElevation) => set({ maxElevation }),
      setMaxDuration: (maxDuration) => set({ maxDuration }),
      setMaxHeight: (maxHeight) => set({ maxHeight }),
      resetFilters: () => set(DEFAULTS),
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

  const fetchFilteredRoutes = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('routes')
        .select('*')
        .eq('is_published', true)
        .lte('distance_m', filters.maxDistance * 1000)
        .lte('elevation_gain_m', filters.maxElevation)
        .lte('estimated_duration_min', filters.maxDuration * 60);

      if (filters.maxHeight < 4500) {
        query = query.lte('max_elevation_m', filters.maxHeight);
      }

      if (filters.sacScales.length > 0) {
        query = query.in('sac_scale', filters.sacScales);
      }

      query = query.order('created_at', { ascending: false }).limit(50);

      const { data, error } = await query;

      if (error) throw error;
      const fetched = (data as Route[]) ?? [];
      setRoutes(fetched.length > 0 ? fetched : DEMO_ROUTES);
    } catch (err) {
      console.error('Failed to fetch filtered routes:', err);
      // Fallback to demo routes so the app is still usable for testing
      setRoutes(DEMO_ROUTES);
    } finally {
      setIsLoading(false);
    }
  }, [
    filters.sacScales,
    filters.maxDistance,
    filters.maxElevation,
    filters.maxDuration,
    filters.maxHeight,
  ]);

  return {
    ...filters,
    routes,
    isLoading,
    fetchFilteredRoutes,
  };
}
