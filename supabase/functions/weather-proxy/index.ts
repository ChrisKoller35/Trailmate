import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_AGENT = 'TrailMate/1.0 info@trailmate.ch';

interface StationForecast {
  station_id: string;
  station_elevation_m: number;
  distance_m: number;
  forecast_time: string;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  cloud_cover: number | null;
  weather_symbol_code: string | null;
  source: string;
}

interface InterpolatedForecast {
  forecast_time: string;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  cloud_cover: number | null;
  weather_symbol_code: string | null;
  source: string;
  station_elevation_m: number;
}

/**
 * Inverse Distance Weighting interpolation for a set of station values.
 * Returns a weighted average based on inverse distance squared.
 */
function idwInterpolate(
  stations: { value: number; distance: number }[],
): number {
  const validStations = stations.filter(
    (s) => s.value !== null && s.value !== undefined && s.distance > 0,
  );

  if (validStations.length === 0) return 0;
  if (validStations.length === 1) return validStations[0].value;

  // Check if any station is at distance ~0
  const zeroDistance = validStations.find((s) => s.distance < 1);
  if (zeroDistance) return zeroDistance.value;

  let weightSum = 0;
  let valueSum = 0;

  for (const station of validStations) {
    const weight = 1 / (station.distance * station.distance);
    weightSum += weight;
    valueSum += weight * station.value;
  }

  return valueSum / weightSum;
}

/**
 * Group station forecasts by time and apply IDW interpolation.
 */
function interpolateForecasts(
  stationForecasts: StationForecast[],
): InterpolatedForecast[] {
  // Group by forecast_time
  const byTime = new Map<string, StationForecast[]>();
  for (const sf of stationForecasts) {
    const existing = byTime.get(sf.forecast_time) ?? [];
    existing.push(sf);
    byTime.set(sf.forecast_time, existing);
  }

  const results: InterpolatedForecast[] = [];

  for (const [time, stations] of byTime) {
    const temperature = idwInterpolate(
      stations
        .filter((s) => s.temperature !== null)
        .map((s) => ({ value: s.temperature!, distance: s.distance_m })),
    );

    const precipitation = idwInterpolate(
      stations
        .filter((s) => s.precipitation !== null)
        .map((s) => ({ value: s.precipitation!, distance: s.distance_m })),
    );

    const windSpeed = idwInterpolate(
      stations
        .filter((s) => s.wind_speed !== null)
        .map((s) => ({ value: s.wind_speed!, distance: s.distance_m })),
    );

    const cloudCover = idwInterpolate(
      stations
        .filter((s) => s.cloud_cover !== null)
        .map((s) => ({ value: s.cloud_cover!, distance: s.distance_m })),
    );

    // Use the symbol from the nearest station
    const nearest = stations.reduce((prev, curr) =>
      curr.distance_m < prev.distance_m ? curr : prev,
    );

    // Weighted average elevation for height correction downstream
    const stationElevation = idwInterpolate(
      stations.map((s) => ({
        value: s.station_elevation_m,
        distance: s.distance_m,
      })),
    );

    results.push({
      forecast_time: time,
      temperature: Math.round(temperature * 10) / 10,
      precipitation: Math.round(precipitation * 10) / 10,
      wind_speed: Math.round(windSpeed * 10) / 10,
      cloud_cover: Math.round(cloudCover),
      weather_symbol_code: nearest.weather_symbol_code,
      source: nearest.source,
      station_elevation_m: Math.round(stationElevation),
    });
  }

  // Sort by forecast time
  results.sort(
    (a, b) =>
      new Date(a.forecast_time).getTime() - new Date(b.forecast_time).getTime(),
  );

  return results;
}

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
    station_elevation_m: 0,
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
