import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_AGENT = 'TrailMate/1.0 info@trailmate.ch';

// Representative grid of ~20 Swiss locations covering all major regions
const SWISS_GRID_POINTS = [
  { id: 'zurich', name: 'Zürich', lat: 47.3769, lng: 8.5417, elevation: 408 },
  { id: 'bern', name: 'Bern', lat: 46.9480, lng: 7.4474, elevation: 540 },
  { id: 'luzern', name: 'Luzern', lat: 47.0502, lng: 8.3093, elevation: 436 },
  { id: 'interlaken', name: 'Interlaken', lat: 46.6863, lng: 7.8632, elevation: 568 },
  { id: 'grindelwald', name: 'Grindelwald', lat: 46.6244, lng: 8.0413, elevation: 1034 },
  { id: 'zermatt', name: 'Zermatt', lat: 46.0207, lng: 7.7491, elevation: 1608 },
  { id: 'davos', name: 'Davos', lat: 46.8003, lng: 9.8360, elevation: 1560 },
  { id: 'stmoritz', name: 'St. Moritz', lat: 46.4908, lng: 9.8355, elevation: 1822 },
  { id: 'locarno', name: 'Locarno', lat: 46.1670, lng: 8.7990, elevation: 196 },
  { id: 'lugano', name: 'Lugano', lat: 46.0037, lng: 8.9511, elevation: 273 },
  { id: 'basel', name: 'Basel', lat: 47.5596, lng: 7.5886, elevation: 260 },
  { id: 'genf', name: 'Genf', lat: 46.2044, lng: 6.1432, elevation: 375 },
  { id: 'lausanne', name: 'Lausanne', lat: 46.5197, lng: 6.6323, elevation: 495 },
  { id: 'sion', name: 'Sion', lat: 46.2298, lng: 7.3607, elevation: 482 },
  { id: 'chur', name: 'Chur', lat: 46.8499, lng: 9.5329, elevation: 593 },
  { id: 'stgallen', name: 'St. Gallen', lat: 47.4245, lng: 9.3767, elevation: 675 },
  { id: 'andermatt', name: 'Andermatt', lat: 46.6337, lng: 8.5942, elevation: 1444 },
  { id: 'saas_fee', name: 'Saas-Fee', lat: 46.1079, lng: 7.9271, elevation: 1798 },
  { id: 'engelberg', name: 'Engelberg', lat: 46.8190, lng: 8.4053, elevation: 1000 },
  { id: 'adelboden', name: 'Adelboden', lat: 46.4920, lng: 7.5600, elevation: 1353 },
];

/**
 * Convert LV95 (Swiss coordinate system) to WGS84.
 * Based on the approximate formulas from swisstopo.
 */
function lv95ToWgs84(east: number, north: number): { lat: number; lng: number } {
  const y = (east - 2600000) / 1000000;
  const x = (north - 1200000) / 1000000;

  const lngSeconds =
    2.6779094 +
    4.728982 * y +
    0.791484 * y * x +
    0.1306 * y * x * x -
    0.0436 * y * y * y;

  const latSeconds =
    16.9023892 +
    3.238272 * x -
    0.270978 * y * y -
    0.002528 * x * x -
    0.0447 * y * y * x -
    0.014 * x * x * x;

  const lng = (lngSeconds * 100) / 36;
  const lat = (latSeconds * 100) / 36;

  return { lat, lng };
}

interface YrNoTimeSeries {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature?: number;
        wind_speed?: number;
        cloud_area_fraction?: number;
        relative_humidity?: number;
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
}

async function fetchYrNoForecast(
  lat: number,
  lng: number,
): Promise<YrNoTimeSeries[]> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`yr.no API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.properties.timeseries as YrNoTimeSeries[];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const results: { station: string; count: number; error?: string }[] = [];

    // Process stations in batches of 5 to respect yr.no rate limits
    for (let i = 0; i < SWISS_GRID_POINTS.length; i += 5) {
      const batch = SWISS_GRID_POINTS.slice(i, i + 5);

      const batchResults = await Promise.allSettled(
        batch.map(async (station) => {
          const timeseries = await fetchYrNoForecast(station.lat, station.lng);

          const forecasts = timeseries.slice(0, 216).map((ts) => {
            const symbolCode =
              ts.data.next_1_hours?.summary.symbol_code ??
              ts.data.next_6_hours?.summary.symbol_code ??
              'cloudy';

            const precipitation =
              ts.data.next_1_hours?.details.precipitation_amount ??
              ts.data.next_6_hours?.details.precipitation_amount ??
              0;

            return {
              station_id: station.id,
              location: `POINT(${station.lng} ${station.lat})`,
              station_elevation_m: station.elevation,
              forecast_time: ts.time,
              temperature: ts.data.instant.details.air_temperature ?? null,
              precipitation,
              wind_speed: ts.data.instant.details.wind_speed ?? null,
              cloud_cover: ts.data.instant.details.cloud_area_fraction ?? null,
              weather_symbol_code: symbolCode,
              source: 'yrno',
              updated_at: new Date().toISOString(),
            };
          });

          // Upsert forecasts — conflict on station_id + forecast_time
          const { error: upsertError } = await supabase
            .from('weather_forecasts')
            .upsert(forecasts, {
              onConflict: 'station_id,forecast_time',
              ignoreDuplicates: false,
            });

          if (upsertError) {
            throw new Error(`Upsert failed for ${station.id}: ${upsertError.message}`);
          }

          return { station: station.id, count: forecasts.length };
        }),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            station: 'unknown',
            count: 0,
            error: result.reason?.message ?? 'Unknown error',
          });
        }
      }

      // Small delay between batches to respect rate limits
      if (i + 5 < SWISS_GRID_POINTS.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Clean up old forecasts (older than 10 days)
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    await supabase
      .from('weather_forecasts')
      .delete()
      .lt('forecast_time', tenDaysAgo.toISOString());

    const totalForecasts = results.reduce((sum, r) => sum + r.count, 0);
    const errors = results.filter((r) => r.error);

    return new Response(
      JSON.stringify({
        success: true,
        processed_stations: results.length,
        total_forecasts: totalForecasts,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'ETL-Fehler aufgetreten',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
