-- ============================================================
-- Migration 007: Gamification, Stats, Live-Tracking, Premium
-- Doc 08: Badge seed data, challenge functions, stats RPCs,
--         live-tracking helpers, notification functions
-- ============================================================

-- ─── Badge Seed Data ───────────────────────────────────────
-- Insert all badge definitions (upsert to be idempotent)

INSERT INTO badges (id, name, description, icon_url, category, rarity) VALUES
  -- 🏔️ Gipfel & Routen
  ('first_summit',    'Erster Gipfel',        '1 Gipfel erreicht',                          '🏔️', 'summits',  'normal'),
  ('5_summits',       '5 Gipfel',             '5 Gipfel erreicht',                          '🏔️', 'summits',  'normal'),
  ('10_summits',      '10 Gipfel',            '10 Gipfel erreicht',                         '🏔️', 'summits',  'rare'),
  ('50_summits',      '50 Gipfel',            '50 Gipfel erreicht',                         '🏔️', 'summits',  'epic'),
  ('summit_2000',     'Über 2000m',           'Gipfel über 2000m erreicht',                 '⛰️', 'summits',  'normal'),
  ('summit_3000',     'Über 3000m',           'Gipfel über 3000m erreicht',                 '⛰️', 'summits',  'rare'),
  ('summit_4000',     'Viertausender',        'Gipfel über 4000m erreicht',                 '🏔️', 'summits',  'epic'),
  -- 📏 Sportliche Leistungen
  ('100km_total',     '100 Kilometer',        '100 km Gesamtdistanz',                       '📏', 'sports',   'normal'),
  ('500km_total',     '500 Kilometer',        '500 km Gesamtdistanz',                       '📏', 'sports',   'rare'),
  ('1000km_total',    '1000 Kilometer',       '1000 km Gesamtdistanz',                      '📏', 'sports',   'epic'),
  ('5000hm_total',    '5000 Höhenmeter',      '5000 hm aufwärts gesamt',                    '↑',  'sports',   'normal'),
  ('10000hm_total',   '10000 Höhenmeter',     '10000 hm aufwärts gesamt',                   '↑',  'sports',   'rare'),
  ('50000hm_total',   '50000 Höhenmeter',     '50000 hm aufwärts gesamt',                   '↑',  'sports',   'epic'),
  ('10_tours',        '10 Touren',            '10 Touren aufgezeichnet',                    '🥾', 'sports',   'normal'),
  ('50_tours',        '50 Touren',            '50 Touren aufgezeichnet',                    '🥾', 'sports',   'rare'),
  ('100_tours',       '100 Touren',           '100 Touren aufgezeichnet',                   '🥾', 'sports',   'epic'),
  ('tour_6h',         'Langstreckenwanderer', 'Tour über 6 Stunden',                        '⏱️', 'sports',   'rare'),
  ('tour_10h',        'Ultramarsch',          'Tour über 10 Stunden',                       '⏱️', 'sports',   'epic'),
  -- 👥 Soziale Abzeichen
  ('first_group_tour','Gemeinsam unterwegs',  'Erste Tour mit App-Nutzer',                  '👥', 'social',   'normal'),
  ('5_partners',      '5 Wanderpartner',      '5 verschiedene Begleiter',                   '👥', 'social',   'rare'),
  ('group_10',        'Grossgruppe',          'Wanderung mit 10 Leuten',                    '👥', 'social',   'rare'),
  ('group_20',        'Massentour',           'Wanderung mit 20 Leuten',                    '👥', 'social',   'epic'),
  ('3_events',        'Eventgänger',          '3 Community-Events besucht',                 '🎉', 'social',   'normal'),
  -- ☕ Fun & Hütten-Abzeichen
  ('first_hut_coffee','Erster Hüttenkaffee',  'Kaffee auf einer Berghütte',                 '☕', 'fun',      'normal'),
  ('5_hut_coffees',   'Hüttenkaffee-Kenner',  'Kaffee auf 5 verschiedenen Hütten',          '☕', 'fun',      'rare'),
  ('3_hut_cakes',     'Hüttenkuchen-Fan',     'Kuchen auf 3 verschiedenen Hütten',          '🍰', 'fun',      'normal'),
  ('10_hut_cakes',    'Tortenmönch',          'Kuchen auf 10 verschiedenen Hütten',         '🍰', 'fun',      'rare'),
  ('first_overnight', 'Erste Übernachtung',   'Erste Hüttenübernachtung',                   '🛏️', 'fun',      'normal'),
  ('hut_fondue',      'Fondue-Wanderer',      'Fondue auf einer Hütte',                     '🫕', 'fun',      'normal'),
  -- 🌦️ Wetter & Jahreszeiten
  ('snow_hike',       'Schneewanderer',       'Tour bei Schnee',                            '❄️', 'weather',  'normal'),
  ('rain_hike',       'Regenfrosch',          'Tour bei Regen',                             '🌧️', 'weather',  'normal'),
  ('winter_hike',     'Winterwanderer',       'Tour in Wintermonaten',                      '🧊', 'weather',  'normal'),
  ('4_seasons_trail', 'Vier Jahreszeiten',    'Alle 4 Jahreszeiten auf demselben Trail',    '🌦️', 'weather',  'epic'),
  -- ⏰ Aktivitäts-Abzeichen
  ('7_day_streak',    '7-Tage-Streak',        '7 Tage in Folge aktiv',                      '🔥', 'activity', 'rare'),
  ('30_tours_year',   'Jahreswanderer',       '30 Touren in einem Jahr',                    '📅', 'activity', 'rare'),
  ('early_bird',      'Frühaufsteher',        'Tour vor 7:00 Uhr gestartet',                '🌅', 'activity', 'normal'),
  -- Spezial-Abzeichen
  ('early_adopter',   'Early Adopter',        'Unter den ersten 1000 Nutzern',              '⭐', 'special',  'epic'),
  ('first_post',      'Erster Post',          'Erster Beitrag erstellt',                    '📝', 'special',  'normal'),
  ('trail_reporter_5','Trail Reporter',       '5 Zustandsmeldungen',                        '📢', 'special',  'normal'),
  ('trail_reporter_25','Pfadfinder',          '25 Zustandsmeldungen',                       '🔍', 'special',  'rare'),
  ('all_cantons',     'Alle Kantone',         'In jedem Kanton gewandert',                   '🗺️', 'summits',  'epic'),
  ('5_canton_peaks',  'Kantonshöchste',       'Höchster Punkt in 5 Kantonen',                '⛰️', 'summits',  'epic')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_url = EXCLUDED.icon_url,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity;


-- ─── Badge Award Function ──────────────────────────────────
-- Called from the app after each recording save
CREATE OR REPLACE FUNCTION award_badge(p_user_id UUID, p_badge_id VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_badges (user_id, badge_id)
  VALUES (p_user_id, p_badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  -- Only create notification if badge was actually new
  IF FOUND THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT p_user_id, 'badge',
           'Neues Abzeichen!',
           'Du hast "' || b.name || '" verdient! 🏆',
           jsonb_build_object('badge_id', p_badge_id, 'badge_name', b.name)
    FROM badges b WHERE b.id = p_badge_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


-- ─── Stats RPC ─────────────────────────────────────────────
-- Compute statistics for a user in a given time range
CREATE OR REPLACE FUNCTION get_user_stats(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT '1970-01-01',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_tours', COUNT(*),
    'total_distance_m', COALESCE(SUM(distance_m), 0),
    'total_elevation_gain_m', COALESCE(SUM(elevation_gain_m), 0),
    'total_elevation_loss_m', COALESCE(SUM(elevation_loss_m), 0),
    'total_duration_seconds', COALESCE(SUM(duration_seconds), 0),
    'avg_duration_seconds', COALESCE(AVG(duration_seconds), 0),
    'avg_speed', COALESCE(AVG(avg_speed_kmh), 0),
    'avg_distance_m', COALESCE(AVG(distance_m), 0),
    'avg_elevation_gain_m', COALESCE(AVG(elevation_gain_m), 0),
    'total_steps', COALESCE(SUM(steps), 0),
    'longest_tour_m', COALESCE(MAX(distance_m), 0),
    'most_elevation_day', COALESCE(MAX(elevation_gain_m), 0),
    'longest_duration_s', COALESCE(MAX(duration_seconds), 0),
    'max_speed', COALESCE(MAX(avg_speed_kmh), 0)
  ) INTO result
  FROM recordings
  WHERE user_id = p_user_id
    AND started_at >= p_start_date
    AND started_at < p_end_date
    AND is_hidden = FALSE;

  RETURN result;
END;
$$;


-- ─── Monthly Activity RPC ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_monthly_activity(
  p_user_id UUID,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(m))
  INTO result
  FROM (
    SELECT
      EXTRACT(MONTH FROM started_at)::INTEGER AS month,
      COUNT(*) AS tours,
      COALESCE(SUM(distance_m), 0) AS distance_m,
      COALESCE(SUM(elevation_gain_m), 0) AS elevation_gain_m
    FROM recordings
    WHERE user_id = p_user_id
      AND EXTRACT(YEAR FROM started_at) = p_year
      AND is_hidden = FALSE
    GROUP BY EXTRACT(MONTH FROM started_at)
    ORDER BY month
  ) m;

  RETURN COALESCE(result, '[]'::JSON);
END;
$$;


-- ─── Personal Records RPC ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_personal_records(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'longest_tour', (SELECT json_build_object('distance_m', distance_m, 'title', title, 'date', started_at::DATE)
      FROM recordings WHERE user_id = p_user_id AND is_hidden = FALSE AND distance_m IS NOT NULL
      ORDER BY distance_m DESC LIMIT 1),
    'longest_tour_km', COALESCE((SELECT distance_m / 1000.0 FROM recordings WHERE user_id = p_user_id AND is_hidden = FALSE AND distance_m IS NOT NULL ORDER BY distance_m DESC LIMIT 1), 0),
    'highest_elevation_m', COALESCE((SELECT elevation_gain_m FROM recordings WHERE user_id = p_user_id AND is_hidden = FALSE AND elevation_gain_m IS NOT NULL ORDER BY elevation_gain_m DESC LIMIT 1), 0),
    'longest_duration_h', COALESCE((SELECT duration_seconds / 3600.0 FROM recordings WHERE user_id = p_user_id AND is_hidden = FALSE AND duration_seconds IS NOT NULL ORDER BY duration_seconds DESC LIMIT 1), 0),
    'most_steps', COALESCE((SELECT steps FROM recordings WHERE user_id = p_user_id AND is_hidden = FALSE AND steps IS NOT NULL ORDER BY steps DESC LIMIT 1), 0),
    'fastest_avg_speed', COALESCE((SELECT avg_speed_kmh FROM recordings WHERE user_id = p_user_id AND is_hidden = FALSE AND avg_speed_kmh IS NOT NULL ORDER BY avg_speed_kmh DESC LIMIT 1), 0),
    'most_elevation', (
      SELECT json_build_object('elevation_gain_m', elevation_gain_m, 'title', title, 'date', started_at::DATE)
      FROM recordings WHERE user_id = p_user_id AND is_hidden = FALSE AND elevation_gain_m IS NOT NULL
      ORDER BY elevation_gain_m DESC LIMIT 1
    ),
    'longest_duration', (
      SELECT json_build_object('duration_seconds', duration_seconds, 'title', title, 'date', started_at::DATE)
      FROM recordings WHERE user_id = p_user_id AND is_hidden = FALSE AND duration_seconds IS NOT NULL
      ORDER BY duration_seconds DESC LIMIT 1
    ),
    'fastest_speed', (
      SELECT json_build_object('avg_speed_kmh', avg_speed_kmh, 'title', title, 'date', started_at::DATE)
      FROM recordings WHERE user_id = p_user_id AND is_hidden = FALSE AND avg_speed_kmh IS NOT NULL
      ORDER BY avg_speed_kmh DESC LIMIT 1
    )
  ) INTO result;

  RETURN result;
END;
$$;


-- ─── Challenge Progress Update Function ────────────────────
CREATE OR REPLACE FUNCTION update_challenge_progress(
  p_user_id UUID,
  p_challenge_id UUID,
  p_progress FLOAT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_goal JSONB;
  v_target FLOAT;
BEGIN
  -- Get challenge goal
  SELECT goal INTO v_goal FROM challenges WHERE id = p_challenge_id;
  v_target := COALESCE((v_goal->>'target')::FLOAT, 0);

  UPDATE challenge_participants
  SET progress = p_progress,
      completed_at = CASE
        WHEN p_progress >= v_target AND completed_at IS NULL THEN NOW()
        ELSE completed_at
      END
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

  -- If just completed, award badge and send notification
  IF p_progress >= v_target THEN
    -- Award challenge badge if one exists
    IF EXISTS (SELECT 1 FROM challenges WHERE id = p_challenge_id AND badge_id IS NOT NULL) THEN
      PERFORM award_badge(p_user_id, (SELECT badge_id FROM challenges WHERE id = p_challenge_id));
    END IF;

    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT p_user_id, 'challenge',
           'Challenge geschafft! 🎉',
           'Du hast "' || c.title || '" abgeschlossen!',
           jsonb_build_object('challenge_id', p_challenge_id)
    FROM challenges c
    WHERE c.id = p_challenge_id
    AND NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = p_user_id AND type = 'challenge'
        AND data->>'challenge_id' = p_challenge_id::TEXT
    );
  END IF;
END;
$$;


-- ─── Challenge Leaderboard RPC ─────────────────────────────
CREATE OR REPLACE FUNCTION get_challenge_leaderboard(
  p_challenge_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(lb))
  INTO result
  FROM (
    SELECT
      cp.user_id,
      u.username,
      u.display_name,
      u.avatar_url,
      cp.progress,
      cp.completed_at,
      RANK() OVER (ORDER BY cp.progress DESC) AS rank
    FROM challenge_participants cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.challenge_id = p_challenge_id
    ORDER BY cp.progress DESC
    LIMIT p_limit
  ) lb;

  RETURN COALESCE(result, '[]'::JSON);
END;
$$;


-- ─── Live Tracking Token Validation ────────────────────────
CREATE OR REPLACE FUNCTION get_live_tracking_by_token(p_token VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', lts.id,
    'user_id', lts.user_id,
    'username', u.display_name,
    'avatar_url', u.avatar_url,
    'last_location', CASE WHEN lts.last_location IS NOT NULL
      THEN json_build_object(
        'longitude', ST_X(lts.last_location),
        'latitude', ST_Y(lts.last_location)
      ) ELSE NULL END,
    'last_updated_at', lts.last_updated_at,
    'expected_return', lts.expected_return,
    'is_active', lts.is_active,
    'started_at', lts.started_at
  ) INTO result
  FROM live_tracking_sessions lts
  JOIN users u ON u.id = lts.user_id
  WHERE lts.share_token = p_token AND lts.is_active = TRUE;

  RETURN result;
END;
$$;


-- ─── Indexes for Performance ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recordings_user_started
  ON recordings (user_id, started_at DESC)
  WHERE is_hidden = FALSE;

CREATE INDEX IF NOT EXISTS idx_user_badges_user
  ON user_badges (user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge
  ON challenge_participants (challenge_id, progress DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_live_tracking_active
  ON live_tracking_sessions (share_token)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_challenges_active
  ON challenges (start_date, end_date)
  WHERE end_date > NOW();


-- ─── Seed Challenges ───────────────────────────────────────
INSERT INTO challenges (id, title, description, type, goal, start_date, end_date, region, is_sponsored)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', '100km im Frühling', '100 Kilometer im Frühling zurücklegen', 'distance',
   '{"target": 100, "unit": "km"}', '2026-03-01', '2026-05-31', NULL, FALSE),
  ('a1b2c3d4-0002-4000-8000-000000000002', '5000 Höhenmeter Challenge', '5000 Höhenmeter in 2 Monaten', 'elevation',
   '{"target": 5000, "unit": "m"}', '2026-03-01', '2026-04-30', NULL, FALSE),
  ('a1b2c3d4-0003-4000-8000-000000000003', '10 Touren im Sommer', '10 Touren im Sommer aufzeichnen', 'tours',
   '{"target": 10, "unit": "tours"}', '2026-06-01', '2026-08-31', NULL, FALSE),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'Berner Oberland Explorer', 'Wandere 50km im Berner Oberland', 'distance',
   '{"target": 50, "unit": "km"}', '2026-03-01', '2026-12-31', 'Berner Oberland', FALSE)
ON CONFLICT (id) DO NOTHING;


-- ─── RLS Policies for new features ─────────────────────────

-- Badges: everyone can read
DROP POLICY IF EXISTS "badges_read_all" ON badges;
CREATE POLICY "badges_read_all" ON badges FOR SELECT USING (TRUE);

-- User badges: owner can read, system inserts via SECURITY DEFINER
DROP POLICY IF EXISTS "user_badges_read_own" ON user_badges;
CREATE POLICY "user_badges_read_own" ON user_badges FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_badges_read_public" ON user_badges;
CREATE POLICY "user_badges_read_public" ON user_badges FOR SELECT
  USING (TRUE);

-- Challenges: everyone can read active ones
DROP POLICY IF EXISTS "challenges_read_active" ON challenges;
CREATE POLICY "challenges_read_active" ON challenges FOR SELECT
  USING (TRUE);

-- Challenge participants: read own + leaderboard via RPC
DROP POLICY IF EXISTS "challenge_participants_read" ON challenge_participants;
CREATE POLICY "challenge_participants_read" ON challenge_participants FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "challenge_participants_insert" ON challenge_participants;
CREATE POLICY "challenge_participants_insert" ON challenge_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "challenge_participants_update_own" ON challenge_participants;
CREATE POLICY "challenge_participants_update_own" ON challenge_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Notifications: user can only read own
DROP POLICY IF EXISTS "notifications_read_own" ON notifications;
CREATE POLICY "notifications_read_own" ON notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Live tracking: owner manages, token-based read via RPC
DROP POLICY IF EXISTS "live_tracking_owner" ON live_tracking_sessions;
CREATE POLICY "live_tracking_owner" ON live_tracking_sessions
  FOR ALL USING (user_id = auth.uid());
