import type { SACScale } from '../types';

export interface RouteFilterValues {
  sacScales: SACScale[];
  minDistance: number; // km
  maxDistance: number; // km
  minElevation: number; // m
  maxElevation: number; // m
  minDuration: number; // hours
  maxDuration: number; // hours
  maxHeight: number; // m above sea level
}

/** Anschläge der +/–-Schalter; ein Maximalwert am Anschlag filtert nicht. */
export const ROUTE_FILTER_LIMITS = {
  distance: { min: 0, max: 50, step: 1 },
  elevation: { min: 0, max: 3000, step: 100 },
  duration: { min: 0, max: 12, step: 1 },
  height: { min: 500, max: 4500, step: 100 },
} as const;

export const DEFAULT_ROUTE_FILTERS: RouteFilterValues = {
  sacScales: [],
  minDistance: ROUTE_FILTER_LIMITS.distance.min,
  maxDistance: ROUTE_FILTER_LIMITS.distance.max,
  minElevation: ROUTE_FILTER_LIMITS.elevation.min,
  maxElevation: ROUTE_FILTER_LIMITS.elevation.max,
  minDuration: ROUTE_FILTER_LIMITS.duration.min,
  maxDuration: ROUTE_FILTER_LIMITS.duration.max,
  maxHeight: ROUTE_FILTER_LIMITS.height.max,
};

/** Teil des Supabase-Query-Builders, den die Filter brauchen. */
export interface RouteFilterBuilder {
  or(filters: string): this;
  gte(column: string, value: number): this;
  lte(column: string, value: number): this;
  in(column: string, values: readonly SACScale[]): this;
}

/**
 * Wendet die Filter auf eine Abfrage der Tabelle `routes` an. Werte am
 * Anschlag (0 bzw. Maximum) setzen keinen Filter, damit Routen ohne
 * Kennzahl (NULL) nicht herausfallen.
 */
export function applyRouteFilters<Q extends RouteFilterBuilder>(
  query: Q,
  f: RouteFilterValues,
): Q {
  let q = query.or('is_published.eq.true,is_curated.eq.true');

  if (f.minDistance > 0) q = q.gte('distance_m', f.minDistance * 1000);
  if (f.maxDistance < ROUTE_FILTER_LIMITS.distance.max) {
    q = q.lte('distance_m', f.maxDistance * 1000);
  }
  if (f.minElevation > 0) q = q.gte('elevation_gain_m', f.minElevation);
  if (f.maxElevation < ROUTE_FILTER_LIMITS.elevation.max) {
    q = q.lte('elevation_gain_m', f.maxElevation);
  }
  if (f.minDuration > 0) q = q.gte('estimated_duration_min', f.minDuration * 60);
  if (f.maxDuration < ROUTE_FILTER_LIMITS.duration.max) {
    q = q.lte('estimated_duration_min', f.maxDuration * 60);
  }
  if (f.maxHeight < ROUTE_FILTER_LIMITS.height.max) {
    q = q.lte('max_elevation_m', f.maxHeight);
  }
  if (f.sacScales.length > 0) q = q.in('sac_scale', f.sacScales);

  return q;
}

export function hasActiveRouteFilters(f: RouteFilterValues): boolean {
  return (
    f.sacScales.length > 0 ||
    f.minDistance !== DEFAULT_ROUTE_FILTERS.minDistance ||
    f.maxDistance !== DEFAULT_ROUTE_FILTERS.maxDistance ||
    f.minElevation !== DEFAULT_ROUTE_FILTERS.minElevation ||
    f.maxElevation !== DEFAULT_ROUTE_FILTERS.maxElevation ||
    f.minDuration !== DEFAULT_ROUTE_FILTERS.minDuration ||
    f.maxDuration !== DEFAULT_ROUTE_FILTERS.maxDuration ||
    f.maxHeight !== DEFAULT_ROUTE_FILTERS.maxHeight
  );
}
