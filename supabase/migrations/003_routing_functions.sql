-- ============================================================
-- Migration 003: Routing Functions & Indexes for Dokument 03
-- ============================================================

-- Spatial index on hiking_network geometry
CREATE INDEX IF NOT EXISTS idx_hiking_network_geom 
  ON hiking_network USING GIST(geom);

-- Source/target indexes for pgRouting
CREATE INDEX IF NOT EXISTS idx_hiking_network_source 
  ON hiking_network(source);
CREATE INDEX IF NOT EXISTS idx_hiking_network_target 
  ON hiking_network(target);

-- Route spatial index
CREATE INDEX IF NOT EXISTS idx_routes_geom 
  ON routes USING GIST(geom);

-- Route filter indexes
CREATE INDEX IF NOT EXISTS idx_routes_published 
  ON routes(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_routes_curated 
  ON routes(is_curated) WHERE is_curated = true;
CREATE INDEX IF NOT EXISTS idx_routes_sac_scale 
  ON routes(sac_scale);
CREATE INDEX IF NOT EXISTS idx_routes_region 
  ON routes(region);
CREATE INDEX IF NOT EXISTS idx_routes_distance 
  ON routes(distance_m);
CREATE INDEX IF NOT EXISTS idx_routes_elevation 
  ON routes(elevation_gain_m);
CREATE INDEX IF NOT EXISTS idx_routes_duration 
  ON routes(estimated_duration_min);

-- Route bookmarks index
CREATE INDEX IF NOT EXISTS idx_route_bookmarks_user 
  ON route_bookmarks(user_id);

-- ============================================================
-- Function: snap_to_network
-- Finds the nearest hiking network node to a given coordinate
-- ============================================================
CREATE OR REPLACE FUNCTION snap_to_network(lng DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS TABLE(snapped_lng DOUBLE PRECISION, snapped_lat DOUBLE PRECISION, node_id INTEGER) AS $$
DECLARE
  snap_point GEOMETRY;
  nearest_edge RECORD;
BEGIN
  -- Find nearest edge
  SELECT h.id, h.source, h.target, h.geom,
         ST_ClosestPoint(h.geom, ST_SetSRID(ST_MakePoint(snap_to_network.lng, snap_to_network.lat), 4326)) AS closest
  INTO nearest_edge
  FROM hiking_network h
  ORDER BY h.geom <-> ST_SetSRID(ST_MakePoint(snap_to_network.lng, snap_to_network.lat), 4326)
  LIMIT 1;

  IF nearest_edge IS NULL THEN
    RETURN QUERY SELECT snap_to_network.lng, snap_to_network.lat, 0;
    RETURN;
  END IF;

  -- Return the snapped point and source node
  RETURN QUERY SELECT 
    ST_X(nearest_edge.closest)::DOUBLE PRECISION,
    ST_Y(nearest_edge.closest)::DOUBLE PRECISION,
    nearest_edge.source;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Function: calculate_hiking_route
-- Calculates a route between two nodes using pgRouting (Dijkstra)
-- with optional SAC scale filter
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_hiking_route(
  start_node INTEGER,
  end_node INTEGER,
  max_sac_scale VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  geojson JSONB,
  distance_m DOUBLE PRECISION,
  elevation_gain_m DOUBLE PRECISION,
  elevation_loss_m DOUBLE PRECISION,
  max_elevation_m DOUBLE PRECISION,
  sac_scale VARCHAR,
  elevation_profile JSONB
) AS $$
DECLARE
  sac_filter TEXT := '';
  route_edges INTEGER[];
  total_dist DOUBLE PRECISION := 0;
  total_gain DOUBLE PRECISION := 0;
  total_loss DOUBLE PRECISION := 0;
  max_elev DOUBLE PRECISION := 0;
  max_sac VARCHAR := 'T1';
  route_geom GEOMETRY;
  profile_data JSONB := '[]'::JSONB;
BEGIN
  -- Build SAC filter clause
  IF max_sac_scale IS NOT NULL THEN
    sac_filter := format(' AND (sac_scale IS NULL OR sac_scale <= %L)', max_sac_scale);
  END IF;

  -- Run Dijkstra routing
  SELECT array_agg(edge) INTO route_edges
  FROM pgr_dijkstra(
    format('SELECT id, source, target, cost FROM hiking_network WHERE cost > 0 %s', sac_filter),
    start_node,
    end_node,
    directed := false
  )
  WHERE edge > 0;

  IF route_edges IS NULL OR array_length(route_edges, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Aggregate route statistics
  SELECT 
    COALESCE(SUM(h.length_m), 0),
    COALESCE(SUM(h.elevation_gain), 0),
    COALESCE(SUM(h.elevation_loss), 0),
    COALESCE(MAX(CASE 
      WHEN h.sac_scale IS NOT NULL THEN h.sac_scale 
      ELSE 'T1' 
    END), 'T1'),
    ST_Union(h.geom ORDER BY array_position(route_edges, h.id))
  INTO total_dist, total_gain, total_loss, max_sac, route_geom
  FROM hiking_network h
  WHERE h.id = ANY(route_edges);

  -- Build elevation profile (sample every ~100m along the merged route)
  IF route_geom IS NOT NULL THEN
    WITH points AS (
      SELECT 
        generate_series(0, 100) AS pct
    ),
    sampled AS (
      SELECT
        pct,
        ST_LineInterpolatePoint(ST_LineMerge(route_geom), pct / 100.0) AS pt
      FROM points
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'distance', ROUND((pct / 100.0 * total_dist)::NUMERIC, 0),
        'elevation', ROUND(ST_Z(pt)::NUMERIC, 0)
      )
    ) INTO profile_data
    FROM sampled
    WHERE ST_Z(pt) IS NOT NULL AND ST_Z(pt) != 0;
  END IF;

  RETURN QUERY SELECT
    ST_AsGeoJSON(ST_LineMerge(route_geom))::JSONB,
    total_dist,
    total_gain,
    total_loss,
    max_elev,
    max_sac,
    COALESCE(profile_data, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Function: get_route_geojson
-- Returns GeoJSON coordinates for a route (used for GPX export)
-- ============================================================
CREATE OR REPLACE FUNCTION get_route_geojson(route_id UUID)
RETURNS JSONB AS $$
  SELECT 
    CASE WHEN geom IS NOT NULL 
      THEN jsonb_build_object(
        'type', 'LineString',
        'coordinates', ST_AsGeoJSON(geom)::JSONB->'coordinates'
      )
      ELSE NULL
    END
  FROM routes
  WHERE id = route_id;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- RLS Policies for route_bookmarks
-- ============================================================
ALTER TABLE route_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own route bookmarks"
  ON route_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own route bookmarks"
  ON route_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own route bookmarks"
  ON route_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- RLS Policies for routes (read access)
-- ============================================================
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published and curated routes are publicly readable"
  ON routes FOR SELECT
  USING (is_published = true OR is_curated = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own routes"
  ON routes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routes"
  ON routes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routes"
  ON routes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- RLS Policies for hiking_network (read-only)  
-- ============================================================
ALTER TABLE hiking_network ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hiking network is publicly readable"
  ON hiking_network FOR SELECT
  USING (true);
