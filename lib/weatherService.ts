import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_AGENT = 'TrailMate/1.0 info@trailmate.ch';
const CACHE_PREFIX = 'weather_cache_';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ─── Types ─────────────────────────────────────────────────

export interface WeatherData {
  forecast_time: string;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  cloud_cover: number | null;
  weather_symbol_code: string | null;
  source: string;
  station_elevation_m: number;
}

export interface WeatherResponse {
  forecasts: WeatherData[];
  source: 'cached' | 'yrno_direct';
  station_count: number;
  timestamp: string;
}

interface CachedWeather {
  data: WeatherResponse;
  cachedAt: number;
}

// ─── Weather Symbol Mapping ────────────────────────────────

const SYMBOL_TO_ICON: Record<string, string> = {
  clearsky_day: 'sun',
  clearsky_night: 'moon',
  clearsky_polartwilight: 'sun',
  fair_day: 'partlyCloudy',
  fair_night: 'partlyCloudyNight',
  fair_polartwilight: 'partlyCloudy',
  partlycloudy_day: 'partlyCloudy',
  partlycloudy_night: 'partlyCloudyNight',
  partlycloudy_polartwilight: 'partlyCloudy',
  cloudy: 'cloudy',
  fog: 'fog',
  lightrain: 'rain',
  rain: 'rain',
  heavyrain: 'heavyRain',
  lightrainshowers_day: 'rain',
  lightrainshowers_night: 'rain',
  rainshowers_day: 'rain',
  rainshowers_night: 'rain',
  heavyrainshowers_day: 'heavyRain',
  heavyrainshowers_night: 'heavyRain',
  lightsnow: 'snow',
  snow: 'snow',
  heavysnow: 'snow',
  lightsnowshowers_day: 'snow',
  lightsnowshowers_night: 'snow',
  snowshowers_day: 'snow',
  snowshowers_night: 'snow',
  heavysnowshowers_day: 'snow',
  heavysnowshowers_night: 'snow',
  lightrainandthunder: 'thunderstorm',
  rainandthunder: 'thunderstorm',
  heavyrainandthunder: 'thunderstorm',
  lightrainshowersandthunder_day: 'thunderstorm',
  lightrainshowersandthunder_night: 'thunderstorm',
  rainshowersandthunder_day: 'thunderstorm',
  rainshowersandthunder_night: 'thunderstorm',
  heavyrainshowersandthunder_day: 'thunderstorm',
  heavyrainshowersandthunder_night: 'thunderstorm',
  lightsnowandthunder: 'thunderstorm',
  snowandthunder: 'thunderstorm',
  heavysnowandthunder: 'thunderstorm',
  lightsleet: 'rain',
  sleet: 'rain',
  heavysleet: 'heavyRain',
  lightsleetshowers_day: 'rain',
  lightsleetshowers_night: 'rain',
  sleetshowers_day: 'rain',
  sleetshowers_night: 'rain',
  heavysleetshowers_day: 'heavyRain',
  heavysleetshowers_night: 'heavyRain',
  sleetandthunder: 'thunderstorm',
  sleetshowersandthunder_day: 'thunderstorm',
  sleetshowersandthunder_night: 'thunderstorm',
  snowshowersandthunder_day: 'thunderstorm',
  snowshowersandthunder_night: 'thunderstorm',
  heavysleetandthunder: 'thunderstorm',
  heavysleetshowersandthunder_day: 'thunderstorm',
  heavysleetshowersandthunder_night: 'thunderstorm',
  heavysnowshowersandthunder_day: 'thunderstorm',
  heavysnowshowersandthunder_night: 'thunderstorm',
};

// ─── Core Functions ────────────────────────────────────────

/**
 * Fetch weather for a given location via the weather-proxy edge function.
 * Falls back to direct yr.no fetch if the edge function is unreachable.
 */
export async function getWeatherForLocation(
  lat: number,
  lng: number,
): Promise<WeatherResponse> {
  // Try cached data first
  const cached = await getCachedWeather(lat, lng);
  if (cached) return cached;

  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/weather-proxy?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Weather proxy error: ${response.status}`);
    }

    const weatherData: WeatherResponse = await response.json();
    await cacheWeatherData(lat, lng, weatherData);
    return weatherData;
  } catch {
    // Fallback: direct yr.no fetch
    try {
      return await fetchYrNoDirect(lat, lng);
    } catch {
      // Final fallback: serve stale cache (for offline use)
      const stale = await getCachedWeather(lat, lng, true);
      if (stale) return stale;
      throw new Error('Keine Wetterdaten verfügbar (offline)');
    }
  }
}

/**
 * Direct fetch from yr.no as a fallback.
 */
async function fetchYrNoDirect(
  lat: number,
  lng: number,
): Promise<WeatherResponse> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`yr.no API error: ${response.status}`);
  }

  const json = await response.json();
  const timeseries = json.properties.timeseries as Array<{
    time: string;
    data: {
      instant: {
        details: {
          air_temperature?: number;
          wind_speed?: number;
          cloud_area_fraction?: number;
        };
      };
      next_1_hours?: {
        summary: { symbol_code: string };
        details: { precipitation_amount?: number };
      };
      next_6_hours?: {
        summary: { symbol_code: string };
        details: { precipitation_amount?: number };
      };
    };
  }>;

  const forecasts: WeatherData[] = timeseries.slice(0, 216).map((ts) => ({
    forecast_time: ts.time,
    temperature: ts.data.instant.details.air_temperature ?? null,
    precipitation:
      ts.data.next_1_hours?.details.precipitation_amount ??
      ts.data.next_6_hours?.details.precipitation_amount ??
      null,
    wind_speed: ts.data.instant.details.wind_speed ?? null,
    cloud_cover: ts.data.instant.details.cloud_area_fraction ?? null,
    weather_symbol_code:
      ts.data.next_1_hours?.summary.symbol_code ??
      ts.data.next_6_hours?.summary.symbol_code ??
      null,
    source: 'yrno',
    station_elevation_m: 0,
  }));

  const result: WeatherResponse = {
    forecasts,
    source: 'yrno_direct',
    station_count: 0,
    timestamp: new Date().toISOString(),
  };

  await cacheWeatherData(lat, lng, result);
  return result;
}

/**
 * Inverse Distance Weighting interpolation.
 * Given multiple station readings and their distances, compute a weighted average.
 */
export function interpolateWeather(
  stations: { value: number; distance: number }[],
): number {
  const valid = stations.filter(
    (s) => s.value !== null && s.value !== undefined && s.distance > 0,
  );

  if (valid.length === 0) return 0;
  if (valid.length === 1) return valid[0].value;

  const zeroDistance = valid.find((s) => s.distance < 1);
  if (zeroDistance) return zeroDistance.value;

  let weightSum = 0;
  let valueSum = 0;

  for (const station of valid) {
    const weight = 1 / (station.distance * station.distance);
    weightSum += weight;
    valueSum += weight * station.value;
  }

  return valueSum / weightSum;
}

/**
 * Correct temperature based on elevation difference using an environmental lapse rate
 * of -0.6°C per 100m altitude gain.
 */
export function correctTemperature(
  stationTemp: number,
  stationElevation: number,
  routeElevation: number,
): number {
  const elevationDiff = routeElevation - stationElevation;
  const correction = (elevationDiff / 100) * -0.6;
  return Math.round((stationTemp + correction) * 10) / 10;
}

/**
 * Map a yr.no / MeteoSwiss weather symbol code to an internal icon name.
 */
export function getWeatherSymbol(code: string | null): string {
  if (!code) return 'cloudy';
  return SYMBOL_TO_ICON[code] ?? 'cloudy';
}

/**
 * Check whether a forecast indicates a weather warning condition.
 */
export function isWeatherWarning(forecast: WeatherData): boolean {
  const code = forecast.weather_symbol_code ?? '';

  // Thunder/storm symbols
  if (code.includes('thunder')) return true;

  // Heavy precipitation
  if (code.includes('heavy')) return true;

  // Very strong wind (>60 km/h = ~16.7 m/s)
  if (forecast.wind_speed !== null && forecast.wind_speed > 16.7) return true;

  // Heavy snow at altitude
  if (code.includes('snow') && forecast.precipitation !== null && forecast.precipitation > 5) {
    return true;
  }

  return false;
}

// ─── Caching ───────────────────────────────────────────────

function getCacheKey(lat: number, lng: number): string {
  // Round to 2 decimal places for spatial grouping (~1km resolution)
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;
  return `${CACHE_PREFIX}${roundedLat}_${roundedLng}`;
}

/**
 * Cache weather data in AsyncStorage.
 */
export async function cacheWeatherData(
  lat: number,
  lng: number,
  data: WeatherResponse,
): Promise<void> {
  try {
    const cacheEntry: CachedWeather = {
      data,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(getCacheKey(lat, lng), JSON.stringify(cacheEntry));
  } catch {
    // Caching failure is non-critical
  }
}

/**
 * Retrieve cached weather data.
 * If forceStale is true, returns data even if expired (for offline use).
 */
export async function getCachedWeather(
  lat: number,
  lng: number,
  forceStale = false,
): Promise<WeatherResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(lat, lng));
    if (!raw) return null;

    const cached: CachedWeather = JSON.parse(raw);
    const age = Date.now() - cached.cachedAt;

    if (!forceStale && age > CACHE_DURATION_MS) {
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}
