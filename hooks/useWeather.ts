import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getWeatherForLocation,
  correctTemperature,
  isWeatherWarning,
  type WeatherData,
} from '../lib/weatherService';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';

// ─── Types ─────────────────────────────────────────────────

export interface DailyForecast {
  date: string;
  label: string;
  tempHigh: number | null;
  tempLow: number | null;
  precipitation: number;
  weather_symbol_code: string | null;
  wind_speed_max: number | null;
}

export interface HourlyForecast {
  time: string;
  label: string;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  weather_symbol_code: string | null;
}

export interface WeatherWarning {
  type: 'thunder' | 'storm' | 'heavy_snow' | 'heavy_rain';
  message: string;
  forecast_time: string;
}

interface UseWeatherReturn {
  forecasts: WeatherData[];
  dailyForecasts: DailyForecast[];
  hourlyForecasts: HourlyForecast[];
  warnings: WeatherWarning[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  source: string | null;
  refresh: () => void;
}

// ─── Helpers ───────────────────────────────────────────────

function formatHour(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getHours().toString().padStart(2, '0')}:00`;
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Heute';
  if (date.toDateString() === tomorrow.toDateString()) return 'Morgen';

  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${weekdays[date.getDay()]} ${day}.${month}`;
}

function getDateKey(isoString: string): string {
  return new Date(isoString).toISOString().split('T')[0];
}

function classifyWarning(forecast: WeatherData): WeatherWarning | null {
  const code = forecast.weather_symbol_code ?? '';

  if (code.includes('thunder')) {
    return {
      type: 'thunder',
      message: 'Gewitterwarnung',
      forecast_time: forecast.forecast_time,
    };
  }

  if (forecast.wind_speed !== null && forecast.wind_speed > 16.7) {
    return {
      type: 'storm',
      message: 'Sturmwarnung – starker Wind erwartet',
      forecast_time: forecast.forecast_time,
    };
  }

  if (
    code.includes('heavysnow') ||
    (code.includes('snow') &&
      forecast.precipitation !== null &&
      forecast.precipitation > 5)
  ) {
    return {
      type: 'heavy_snow',
      message: 'Starker Schneefall erwartet',
      forecast_time: forecast.forecast_time,
    };
  }

  if (code.includes('heavyrain')) {
    return {
      type: 'heavy_rain',
      message: 'Starkregen erwartet',
      forecast_time: forecast.forecast_time,
    };
  }

  return null;
}

// ─── Hook ──────────────────────────────────────────────────

export function useWeather(
  _routeId?: string,
  lat?: number,
  lng?: number,
  elevation?: number,
): UseWeatherReturn {
  const profile = useAuthStore((state) => state.profile);
  const isPremium = profile?.is_premium ?? false;

  const weatherQuery = useQuery({
    queryKey: queryKeys.weather(lat!, lng!),
    queryFn: async () => {
      const response = await getWeatherForLocation(lat!, lng!);
      let forecasts = response.forecasts;

      // Apply height correction for premium users
      if (isPremium && elevation !== undefined) {
        forecasts = forecasts.map((f) => ({
          ...f,
          temperature:
            f.temperature !== null
              ? correctTemperature(f.temperature, f.station_elevation_m, elevation)
              : null,
        }));
      }

      return {
        forecasts,
        source: response.source,
        lastUpdated: response.timestamp,
      };
    },
    enabled: lat !== undefined && lng !== undefined,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,    // 1 hour
  });

  const forecasts = weatherQuery.data?.forecasts ?? [];
  const source = weatherQuery.data?.source ?? null;
  const lastUpdated = weatherQuery.data?.lastUpdated ?? null;
  const isLoading = weatherQuery.isLoading;
  const error = weatherQuery.error instanceof Error ? weatherQuery.error.message : null;
  const refresh = weatherQuery.refetch;

  // ─── Derived data ──────────────────────────────────────

  // Hourly: next 12 hours
  const hourlyForecasts: HourlyForecast[] = useMemo(
    () =>
      forecasts
        .filter((f) => new Date(f.forecast_time) >= new Date())
        .slice(0, 12)
        .map((f) => ({
          time: f.forecast_time,
          label: formatHour(f.forecast_time),
          temperature: f.temperature,
          precipitation: f.precipitation,
          wind_speed: f.wind_speed,
          weather_symbol_code: f.weather_symbol_code,
        })),
    [forecasts],
  );

  // Daily: group by day, compute min/max/total
  const dailyForecasts: DailyForecast[] = useMemo(() => {
    const dailyMap = new Map<
      string,
      {
        temps: number[];
        precip: number[];
        windMax: number;
        symbols: string[];
      }
    >();

    for (const f of forecasts) {
      const dateKey = getDateKey(f.forecast_time);
      const entry = dailyMap.get(dateKey) ?? {
        temps: [],
        precip: [],
        windMax: 0,
        symbols: [],
      };

      if (f.temperature !== null) entry.temps.push(f.temperature);
      if (f.precipitation !== null) entry.precip.push(f.precipitation);
      if (f.wind_speed !== null && f.wind_speed > entry.windMax) {
        entry.windMax = f.wind_speed;
      }
      if (f.weather_symbol_code) entry.symbols.push(f.weather_symbol_code);

      dailyMap.set(dateKey, entry);
    }

    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 9)
      .map(([date, data]) => {
        // Pick the most common symbol for the day
        const symbolCounts = new Map<string, number>();
        for (const s of data.symbols) {
          symbolCounts.set(s, (symbolCounts.get(s) ?? 0) + 1);
        }
        let dominantSymbol: string | null = null;
        let maxCount = 0;
        for (const [symbol, count] of symbolCounts) {
          if (count > maxCount) {
            maxCount = count;
            dominantSymbol = symbol;
          }
        }

        return {
          date,
          label: formatDayLabel(date),
          tempHigh:
            data.temps.length > 0
              ? Math.round(Math.max(...data.temps) * 10) / 10
              : null,
          tempLow:
            data.temps.length > 0
              ? Math.round(Math.min(...data.temps) * 10) / 10
              : null,
          precipitation: Math.round(data.precip.reduce((a, b) => a + b, 0) * 10) / 10,
          weather_symbol_code: dominantSymbol,
          wind_speed_max: data.windMax > 0 ? Math.round(data.windMax * 10) / 10 : null,
        };
      });
  }, [forecasts]);

  // Warnings
  const warnings: WeatherWarning[] = useMemo(() => {
    const warningSet = new Set<string>();
    const result: WeatherWarning[] = [];

    for (const f of forecasts) {
      if (isWeatherWarning(f)) {
        const warning = classifyWarning(f);
        if (warning && !warningSet.has(warning.type)) {
          warningSet.add(warning.type);
          result.push(warning);
        }
      }
    }

    return result;
  }, [forecasts]);

  return {
    forecasts,
    dailyForecasts,
    hourlyForecasts,
    warnings,
    isLoading,
    error,
    lastUpdated,
    source,
    refresh,
  };
}
