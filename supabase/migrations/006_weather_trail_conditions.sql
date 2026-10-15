-- ============================================================
-- Migration 006: Weather, ÖV & Trail Conditions helpers
-- Doc 07 – Wetter, ÖV-Integration & Trail Conditions
-- ============================================================

-- ─── Weather: Nearest stations query function ──────────────
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
  ORDER BY dist_m, wf.forecast_time
  LIMIT p_limit * 24;
$$;

-- ─── Weather: Unique constraint for upsert ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weather_forecasts_station_time_unique'
  ) THEN
    ALTER TABLE weather_forecasts
      ADD CONSTRAINT weather_forecasts_station_time_unique
      UNIQUE (station_id, forecast_time);
  END IF;
END $$;

-- ─── Weather: Cleanup old forecasts (> 10 days) ────────────
CREATE OR REPLACE FUNCTION cleanup_old_weather()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM weather_forecasts
  WHERE forecast_time < NOW() - INTERVAL '10 days';
$$;

-- ─── Trail Conditions: Auto-archive after 14 days ──────────
CREATE OR REPLACE FUNCTION archive_old_trail_conditions()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE trail_conditions
  SET expires_at = NOW()
  WHERE reported_at < NOW() - INTERVAL '14 days'
    AND expires_at IS NULL;
$$;

-- ─── Trail Conditions: Upvote function (SECURITY DEFINER) ──
-- Only allows incrementing helpfulness_score, no raw UPDATE policy needed
CREATE OR REPLACE FUNCTION upvote_trail_condition(p_condition_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only increment score, nothing else can be changed
  UPDATE trail_conditions
  SET helpfulness_score = helpfulness_score + 1
  WHERE id = p_condition_id;
END;
$$;

-- ─── Badges: Trail Reporter badges ────────────────────────
INSERT INTO badges (id, name, description, icon_url, category, rarity)
VALUES
  (
    'badge-trail-reporter',
    'Trail Reporter',
    '5 Wegzustandsberichte eingereicht',
    'trail-reporter',
    'community',
    'normal'
  ),
  (
    'badge-pfadfinder',
    'Pfadfinder',
    '25 Wegzustandsberichte eingereicht',
    'pfadfinder',
    'community',
    'rare'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Trail Conditions: Count trigger for badge check ───────
CREATE OR REPLACE FUNCTION check_trail_reporter_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM trail_conditions
  WHERE user_id = NEW.user_id;

  -- Trail Reporter badge at 5 reports
  IF report_count >= 5 THEN
    INSERT INTO user_badges (user_id, badge_id, earned_at)
    VALUES (NEW.user_id, 'badge-trail-reporter', NOW())
    ON CONFLICT DO NOTHING;
  END IF;

  -- Pfadfinder badge at 25 reports
  IF report_count >= 25 THEN
    INSERT INTO user_badges (user_id, badge_id, earned_at)
    VALUES (NEW.user_id, 'badge-pfadfinder', NOW())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trail_reporter_badges ON trail_conditions;
CREATE TRIGGER trg_trail_reporter_badges
  AFTER INSERT ON trail_conditions
  FOR EACH ROW
  EXECUTE FUNCTION check_trail_reporter_badges();

-- ─── Notification trigger for bookmarked route conditions ──
CREATE OR REPLACE FUNCTION notify_bookmarked_route_condition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (id, user_id, type, title, body, data)
  SELECT
    gen_random_uuid(),
    rb.user_id,
    'trail_condition',
    'Neuer Wegbericht',
    'Ein neuer Zustandsbericht für eine gemerkte Route ist verfügbar.',
    jsonb_build_object(
      'route_id', NEW.route_id,
      'condition_id', NEW.id
    )
  FROM route_bookmarks rb
  WHERE rb.route_id = NEW.route_id
    AND rb.user_id != NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bookmarked_trail_condition ON trail_conditions;
CREATE TRIGGER trg_notify_bookmarked_trail_condition
  AFTER INSERT ON trail_conditions
  FOR EACH ROW
  EXECUTE FUNCTION notify_bookmarked_route_condition();

-- ─── Cron jobs (require pg_cron extension) ─────────────────
-- Note: These should be run manually in the Supabase dashboard
-- if pg_cron is not enabled via migration

-- Hourly weather ETL
-- SELECT cron.schedule(
--   'weather-etl',
--   '0 * * * *',
--   $$SELECT net.http_post(
--     current_setting('app.supabase_url') || '/functions/v1/weather-etl',
--     '{}',
--     'application/json',
--     ARRAY[
--       ('Authorization', 'Bearer ' || current_setting('app.service_role_key'))::http_header
--     ]
--   )$$
-- );

-- Daily cleanup of old weather data
-- SELECT cron.schedule(
--   'weather-cleanup',
--   '0 3 * * *',
--   $$SELECT cleanup_old_weather()$$
-- );

-- Daily archive of old trail conditions
-- SELECT cron.schedule(
--   'trail-conditions-archive',
--   '0 4 * * *',
--   $$SELECT archive_old_trail_conditions()$$
-- );

-- ─── Indexes for performance ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trail_conditions_reported_at
  ON trail_conditions(reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_trail_conditions_user
  ON trail_conditions(user_id);

CREATE INDEX IF NOT EXISTS idx_weather_station_id
  ON weather_forecasts(station_id);

-- ─── Route: Extract start/end points ───────────────────────
CREATE OR REPLACE FUNCTION get_route_endpoints(p_route_id UUID)
RETURNS TABLE (
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lng DOUBLE PRECISION,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ST_Y(ST_StartPoint(geom)) AS start_lat,
    ST_X(ST_StartPoint(geom)) AS start_lng,
    ST_Y(ST_EndPoint(geom)) AS end_lat,
    ST_X(ST_EndPoint(geom)) AS end_lng,
    ST_Y(ST_Centroid(geom)) AS center_lat,
    ST_X(ST_Centroid(geom)) AS center_lng
  FROM routes
  WHERE id = p_route_id
    AND geom IS NOT NULL;
$$;
