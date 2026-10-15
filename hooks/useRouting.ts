import { useState, useCallback } from 'react';
import { calculateHikingRoute } from '../lib/brouterService';
import { DEMO_ROUTE_RESULT } from '../__fixtures__/demoData';
import type { SACScale } from '../types';

export interface RouteResult {
  geojson: GeoJSON.FeatureCollection;
  distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  estimated_duration_min: number;
  sac_scale: SACScale | null;
  max_elevation_m: number | null;
  elevationProfile: { distance: number; elevation: number }[];
}

interface RoutingOptions {
  sacFilter?: SACScale[];
  waypoints?: [number, number][];
}

/**
 * SAC hiking time formula:
 * - Horizontal: 1 km = 15 min
 * - Ascent: 100 m = 15 min
 * - Descent (easy, <20°): 100 m = 7.5 min
 * The lesser of horizontal / vertical time is halved and added.
 */
export function estimateDuration(
  distance_m: number,
  elevation_gain_m: number,
  elevation_loss_m: number,
): number {
  const horizontalMin = (distance_m / 1000) * 15;
  const ascentMin = (elevation_gain_m / 100) * 15;
  const descentMin = (elevation_loss_m / 100) * 7.5;

  const verticalMin = ascentMin + descentMin;

  // SAC rule: larger value full + smaller value half
  if (horizontalMin >= verticalMin) {
    return horizontalMin + verticalMin / 2;
  }
  return verticalMin + horizontalMin / 2;
}

export function useRouting() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculateRoute = useCallback(
    async (
      start: [number, number],
      end: [number, number],
      options?: RoutingOptions,
    ): Promise<RouteResult | null> => {
      setIsCalculating(true);
      setError(null);

      try {
        // Use BRouter for real hiking trail routing
        const data = await calculateHikingRoute(
          start,
          end,
          options?.waypoints,
        );

        const duration = estimateDuration(
          data.distance_m,
          data.elevation_gain_m,
          data.elevation_loss_m,
        );

        const result: RouteResult = {
          geojson: data.geojson,
          distance_m: data.distance_m,
          elevation_gain_m: data.elevation_gain_m,
          elevation_loss_m: data.elevation_loss_m,
          estimated_duration_min: Math.round(duration),
          sac_scale: null, // BRouter doesn't provide SAC scale
          max_elevation_m: data.max_elevation_m,
          elevationProfile: data.elevationProfile,
        };

        setRouteResult(result);
        return result;
      } catch (err: any) {
        const message = err?.message ?? 'Route calculation failed';
        setError(message);
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    [],
  );

  const clearRoute = useCallback(() => {
    setRouteResult(null);
    setError(null);
  }, []);

  const loadDemoRoute = useCallback(() => {
    setRouteResult(DEMO_ROUTE_RESULT);
    setError(null);
  }, []);

  return {
    calculateRoute,
    clearRoute,
    loadDemoRoute,
    routeResult,
    isCalculating,
    error,
    estimateDuration,
  };
}
