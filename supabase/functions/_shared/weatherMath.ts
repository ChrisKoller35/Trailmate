// Pure weather calculations shared by the weather-proxy Edge Function (Deno)
// and the app (lib/weatherService.ts). Keep this file free of imports so it
// runs unchanged in both runtimes.

/** One row as returned by the SQL function `get_nearest_weather` (migration 008). */
export interface StationForecast {
  station_id: string;
  station_elevation_m: number | null;
  dist_m: number;
  forecast_time: string;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  cloud_cover: number | null;
  weather_symbol_code: string | null;
  source: string;
}

export interface InterpolatedForecast {
  forecast_time: string;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  cloud_cover: number | null;
  weather_symbol_code: string | null;
  source: string;
  /** Elevation the values refer to; 0 means unknown (no height correction). */
  station_elevation_m: number;
}

/**
 * Inverse Distance Weighting with weight 1/d (Doc 07).
 * Returns null when no station has a value, so a missing reading never turns into 0.
 */
export function idwInterpolate(
  stations: { value: number | null | undefined; distance: number }[],
): number | null {
  const valid = stations.filter(
    (s): s is { value: number; distance: number } =>
      s.value !== null && s.value !== undefined && s.distance >= 0,
  );

  if (valid.length === 0) return null;

  // A station (almost) on the spot wins outright and avoids dividing by 0.
  const onSpot = valid.find((s) => s.distance < 1);
  if (onSpot) return onSpot.value;

  let weightSum = 0;
  let valueSum = 0;
  for (const s of valid) {
    const weight = 1 / s.distance;
    weightSum += weight;
    valueSum += weight * s.value;
  }
  return valueSum / weightSum;
}

function round(value: number | null, factor: number): number | null {
  return value === null ? null : Math.round(value * factor) / factor;
}

/** Group station rows by forecast time and interpolate each value with IDW. */
export function interpolateForecasts(rows: StationForecast[]): InterpolatedForecast[] {
  const byTime = new Map<string, StationForecast[]>();
  for (const row of rows) {
    const list = byTime.get(row.forecast_time) ?? [];
    list.push(row);
    byTime.set(row.forecast_time, list);
  }

  const results: InterpolatedForecast[] = [];
  for (const [time, stations] of byTime) {
    const idw = (pick: (s: StationForecast) => number | null) =>
      idwInterpolate(stations.map((s) => ({ value: pick(s), distance: s.dist_m })));

    // Symbol and source come from the nearest station
    const nearest = stations.reduce((prev, curr) => (curr.dist_m < prev.dist_m ? curr : prev));

    results.push({
      forecast_time: time,
      temperature: round(
        idw((s) => s.temperature),
        10,
      ),
      precipitation: round(
        idw((s) => s.precipitation),
        10,
      ),
      wind_speed: round(
        idw((s) => s.wind_speed),
        10,
      ),
      cloud_cover: round(
        idw((s) => s.cloud_cover),
        1,
      ),
      weather_symbol_code: nearest.weather_symbol_code,
      source: nearest.source,
      station_elevation_m: Math.round(idw((s) => s.station_elevation_m) ?? 0),
    });
  }

  results.sort((a, b) => new Date(a.forecast_time).getTime() - new Date(b.forecast_time).getTime());
  return results;
}

/**
 * Model elevation of a yr.no locationforecast response (GeoJSON `[lon, lat, altitude]`).
 * Returns 0 when yr.no does not report it, which disables the height correction.
 */
export function yrNoModelElevation(json: { geometry?: { coordinates?: number[] } }): number {
  const altitude = json.geometry?.coordinates?.[2];
  return typeof altitude === 'number' && Number.isFinite(altitude) ? altitude : 0;
}

/**
 * Correct a temperature to the route elevation with a lapse rate of −0.6 °C per 100 m.
 * Without a known station elevation (≤ 0) the temperature is returned unchanged,
 * otherwise the full route height would be subtracted.
 */
export function correctTemperature(
  stationTemp: number,
  stationElevation: number | null,
  routeElevation: number,
): number {
  if (stationElevation === null || stationElevation <= 0) return stationTemp;
  const correction = ((routeElevation - stationElevation) / 100) * -0.6;
  return Math.round((stationTemp + correction) * 10) / 10;
}
