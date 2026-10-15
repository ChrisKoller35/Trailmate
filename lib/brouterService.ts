/**
 * BRouter hiking route service.
 * Uses the free BRouter API (brouter.de) which routes along actual hiking trails
 * from OpenStreetMap data — including the full Swiss hiking network.
 *
 * No API key required. Returns GeoJSON with 3D coordinates (lng, lat, elevation).
 */

const BROUTER_BASE = 'https://brouter.de/brouter';

interface BRouterResult {
  geojson: GeoJSON.FeatureCollection;
  distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_elevation_m: number;
  elevationProfile: { distance: number; elevation: number }[];
}

/**
 * Calculate Haversine distance between two points in meters.
 */
function haversineDistance(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Extract elevation stats and profile from 3D GeoJSON coordinates.
 */
function analyzeElevation(
  coords: number[][],
): Pick<BRouterResult, 'elevation_gain_m' | 'elevation_loss_m' | 'max_elevation_m' | 'elevationProfile'> {
  let gain = 0;
  let loss = 0;
  let maxElev = -Infinity;
  let cumulativeDistance = 0;

  const profile: { distance: number; elevation: number }[] = [];

  // Sample every ~100m for the elevation profile
  let lastProfileDist = -Infinity;

  for (let i = 0; i < coords.length; i++) {
    const elev = coords[i][2] ?? 0;

    if (elev > maxElev) maxElev = elev;

    if (i > 0) {
      const segDist = haversineDistance(
        [coords[i - 1][0], coords[i - 1][1]],
        [coords[i][0], coords[i][1]],
      );
      cumulativeDistance += segDist;

      const prevElev = coords[i - 1][2] ?? 0;
      const diff = elev - prevElev;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }

    // Add to profile roughly every 100m or at start/end
    if (
      i === 0 ||
      i === coords.length - 1 ||
      cumulativeDistance - lastProfileDist >= 100
    ) {
      profile.push({
        distance: Math.round(cumulativeDistance) / 1000, // km
        elevation: Math.round(elev),
      });
      lastProfileDist = cumulativeDistance;
    }
  }

  return {
    elevation_gain_m: Math.round(gain),
    elevation_loss_m: Math.round(loss),
    max_elevation_m: Math.round(maxElev),
    elevationProfile: profile,
  };
}

/**
 * Calculate a hiking route via BRouter.
 * @param start [lng, lat]
 * @param end [lng, lat]
 * @param waypoints Optional intermediate points [[lng, lat], ...]
 */
export async function calculateHikingRoute(
  start: [number, number],
  end: [number, number],
  waypoints?: [number, number][],
): Promise<BRouterResult> {
  // Build lonlats parameter: start|wp1|wp2|...|end
  const points = [start, ...(waypoints ?? []), end];
  const lonlats = points.map(([lng, lat]) => `${lng},${lat}`).join('|');

  const url = `${BROUTER_BASE}?lonlats=${lonlats}&profile=hiking-beta&alternativeidx=0&format=geojson`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    if (text.includes('no track found') || text.includes('no route')) {
      throw new Error('Keine Wanderroute gefunden. Versuche Punkte näher an einem Wanderweg zu setzen.');
    }
    throw new Error(`Routing failed (${response.status})`);
  }

  const geojson: GeoJSON.FeatureCollection = await response.json();

  // Extract coordinates from the first LineString feature
  const lineFeature = geojson.features?.find(
    (f) => f.geometry?.type === 'LineString',
  );

  if (!lineFeature || lineFeature.geometry.type !== 'LineString') {
    throw new Error('Keine gültige Route erhalten');
  }

  const coords = lineFeature.geometry.coordinates as number[][];

  // Calculate total distance
  let totalDistance = 0;
  for (let i = 1; i < coords.length; i++) {
    totalDistance += haversineDistance(
      [coords[i - 1][0], coords[i - 1][1]],
      [coords[i][0], coords[i][1]],
    );
  }

  const elevationData = analyzeElevation(coords);

  // BRouter sometimes includes track-length in feature properties
  const trackLength = lineFeature.properties?.['track-length'];
  const distance_m = trackLength
    ? parseFloat(trackLength)
    : Math.round(totalDistance);

  return {
    geojson,
    distance_m,
    ...elevationData,
  };
}
