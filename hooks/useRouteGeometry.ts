// hooks/useRouteGeometry.ts
// Linie einer geplanten Route über get_route_geojson (RLS: nur lesbare
// Routen). Ohne Linie null. Fehler wirft die Abfrage, damit React Query es
// nochmals versucht und kein «keine Linie» für eine Stunde speichert; der
// Hook gibt dann null zurück, die Aufnahme geht auch ohne Linie.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';

export interface RouteLineFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'LineString'; coordinates: number[][] };
}

export async function fetchRouteGeometry(routeId: string): Promise<RouteLineFeature | null> {
  const { data, error } = await supabase.rpc('get_route_geojson', { route_id: routeId });
  if (error) throw error;
  if (data?.type !== 'LineString' || !Array.isArray(data.coordinates)) return null;
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: data.coordinates as number[][] },
  };
}

export function useRouteGeometry(routeId: string | null): RouteLineFeature | null {
  const { data } = useQuery({
    queryKey: queryKeys.routeGeometry(routeId ?? ''),
    queryFn: () => fetchRouteGeometry(routeId as string),
    enabled: !!routeId,
    staleTime: 60 * 60 * 1000,
  });
  return routeId ? data ?? null : null;
}
