import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  interpolateForecasts,
  yrNoModelElevation,
  type InterpolatedForecast,
  type StationForecast,
} from '../_shared/weatherMath.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_AGENT = 'TrailMate/1.0 info@trailmate.ch';

async function fetchYrNoDirectly(
  lat: number,
  lng: number,
): Promise<InterpolatedForecast[]> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`yr.no fetch failed: ${response.status}`);
  }

  const data = await response.json();
  const modelElevation = yrNoModelElevation(data);
  const timeseries = data.properties.timeseries as Array<{
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

  return timeseries.slice(0, 216).map((ts) => ({
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
    source: 'yrno' as const,
    station_elevation_m: modelElevation,
  }));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get('lat') ?? '');
    const lng = parseFloat(url.searchParams.get('lng') ?? '');

    if (isNaN(lat) || isNaN(lng)) {
      return new Response(
        JSON.stringify({ error: 'Parameter lat und lng sind erforderlich' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response(
        JSON.stringify({ error: 'Ungültige Koordinaten' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Query nearest 3 stations within 15km using ST_DWithin
    const { data: nearbyForecasts, error: queryError } = await supabase.rpc(
      'get_nearest_weather',
      {
        p_lng: lng,
        p_lat: lat,
        p_radius_m: 15000,
        p_limit: 3,
      },
    );

    if (queryError) {
      console.error('DB query error:', queryError.message);
    }

    let forecasts: InterpolatedForecast[];

    if (nearbyForecasts && nearbyForecasts.length > 0) {
      // We have cached station data — interpolate
      forecasts = interpolateForecasts(nearbyForecasts as StationForecast[]);
    } else {
      // Fallback: fetch directly from yr.no
      forecasts = await fetchYrNoDirectly(lat, lng);
    }

    return new Response(
      JSON.stringify({
        forecasts,
        source:
          nearbyForecasts && nearbyForecasts.length > 0
            ? 'cached'
            : 'yrno_direct',
        station_count:
          nearbyForecasts?.length
            ? new Set(
                (nearbyForecasts as StationForecast[]).map((f) => f.station_id),
              ).size
            : 0,
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
        error:
          error instanceof Error
            ? error.message
            : 'Wetterdaten konnten nicht geladen werden',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
