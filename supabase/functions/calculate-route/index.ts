import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { start, end, sac_filter, waypoints } = await req.json();

    if (!start || !end || !Array.isArray(start) || !Array.isArray(end)) {
      return new Response(
        JSON.stringify({ error: 'Start und Ziel sind erforderlich (jeweils [lng, lat])' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Step 1: Snap start and end to nearest network nodes
    const [startSnap, endSnap] = await Promise.all([
      supabase.rpc('snap_to_network', { lng: start[0], lat: start[1] }),
      supabase.rpc('snap_to_network', { lng: end[0], lat: end[1] }),
    ]);

    if (startSnap.error || !startSnap.data?.[0]) {
      return new Response(
        JSON.stringify({ error: 'Startpunkt konnte nicht aufs Wanderwegnetz gelegt werden' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (endSnap.error || !endSnap.data?.[0]) {
      return new Response(
        JSON.stringify({ error: 'Zielpunkt konnte nicht aufs Wanderwegnetz gelegt werden' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const startNode = startSnap.data[0].node_id;
    const endNode = endSnap.data[0].node_id;

    // Determine max SAC scale from filter
    const maxSacScale = sac_filter && sac_filter.length > 0
      ? sac_filter.sort().pop()
      : null;

    // Step 2: Calculate route via pgRouting
    const { data: routeData, error: routeError } = await supabase.rpc(
      'calculate_hiking_route',
      {
        start_node: startNode,
        end_node: endNode,
        max_sac_scale: maxSacScale,
      },
    );

    if (routeError) {
      return new Response(
        JSON.stringify({ error: routeError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!routeData || routeData.length === 0 || !routeData[0]?.geojson) {
      return new Response(
        JSON.stringify({ error: 'Keine Route gefunden. Versuche einen anderen SAC-Filter.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const result = routeData[0];

    // SAC duration formula
    const horizontalMin = (result.distance_m / 1000) * 15;
    const ascentMin = (result.elevation_gain_m / 100) * 15;
    const descentMin = (result.elevation_loss_m / 100) * 7.5;
    const verticalMin = ascentMin + descentMin;
    const estimatedDuration = horizontalMin >= verticalMin
      ? horizontalMin + verticalMin / 2
      : verticalMin + horizontalMin / 2;

    // Build response GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: result.geojson,
          properties: {
            distance_m: result.distance_m,
            elevation_gain_m: result.elevation_gain_m,
            elevation_loss_m: result.elevation_loss_m,
            sac_scale: result.sac_scale,
          },
        },
      ],
    };

    return new Response(
      JSON.stringify({
        geojson,
        distance_m: result.distance_m,
        elevation_gain_m: result.elevation_gain_m,
        elevation_loss_m: result.elevation_loss_m,
        estimated_duration_min: Math.round(estimatedDuration),
        sac_scale: result.sac_scale,
        max_elevation_m: result.max_elevation_m,
        elevation_profile: result.elevation_profile ?? [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Interner Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
