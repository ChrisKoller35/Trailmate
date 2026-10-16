-- ============================================================
-- Migration 008: get_nearest_weather returns the 3 nearest stations
-- Doc 07 – Ist-Soll 07, Aufgabe 1
-- ============================================================
-- Before: rows were ordered by distance and cut at p_limit * 24, so with
-- 216 hourly rows per station only the nearest station came back and the
-- weather-proxy could not interpolate between stations.
-- After: pick the p_limit nearest distinct stations first, then return all
-- their future forecast hours. Signature and columns are unchanged.

CREATE OR REPLACE FUNCTION get_nearest_weather(
  p_lng DOUBLE PRECISION,
  p_lat DOUBLE PRECISION,
  p_radius_m INTEGER DEFAULT 15000,
  p_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
  station_id VARCHAR(20),
  temperature FLOAT,
  precipitation FLOAT,
  wind_speed FLOAT,
  cloud_cover FLOAT,
  weather_symbol_code VARCHAR(10),
  station_elevation_m FLOAT,
  forecast_time TIMESTAMPTZ,
  source VARCHAR(20),
  dist_m DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  WITH nearest AS (
    SELECT st.station_id, st.dist_m
    FROM (
      SELECT DISTINCT ON (wf.station_id)
        wf.station_id,
        ST_Distance(
          wf.location::geography,
          ST_MakePoint(p_lng, p_lat)::geography
        ) AS dist_m
      FROM weather_forecasts wf
      WHERE wf.forecast_time >= NOW()
        AND ST_DWithin(
          wf.location::geography,
          ST_MakePoint(p_lng, p_lat)::geography,
          p_radius_m
        )
      ORDER BY wf.station_id
    ) st
    ORDER BY st.dist_m
    LIMIT p_limit
  )
  SELECT
    wf.station_id,
    wf.temperature,
    wf.precipitation,
    wf.wind_speed,
    wf.cloud_cover,
    wf.weather_symbol_code,
    wf.station_elevation_m,
    wf.forecast_time,
    wf.source,
    n.dist_m
  FROM weather_forecasts wf
  JOIN nearest n ON n.station_id = wf.station_id
  WHERE wf.forecast_time >= NOW()
  ORDER BY wf.forecast_time, n.dist_m;
$$;
