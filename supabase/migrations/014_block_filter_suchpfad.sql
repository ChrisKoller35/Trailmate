-- ============================================================
-- 014: Block-Filter in allen Lese-Regeln, feste Suchpfade
-- ============================================================
-- Behebt Ist-Soll 01, Sicherheitsauffälligkeiten 1 und 3.
--
-- 1. Postgres verknüpft erlaubende Policies mit ODER. Die Policies aus
--    003 und 007 ohne is_blocked() hoben deshalb den Block-Filter aus 002
--    auf. Sie werden entfernt; die Policies aus 002 werden so neu
--    angelegt, dass eigene Zeilen immer sichtbar sind und fremde nur ohne
--    Blockierung (in beide Richtungen).
-- 2. Alle SECURITY-DEFINER-Funktionen ohne festen Suchpfad erhalten
--    SET search_path = public. Funktionskörper bleiben unverändert.
--    (009, 011, 012, 013 setzen ihn bereits; get_explore_feed und
--    increment_report_count wurden dort neu definiert.)

-- ─── 1. Routen ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Published and curated routes are publicly readable" ON routes;

DROP POLICY IF EXISTS routes_select ON routes;
CREATE POLICY routes_select ON routes FOR SELECT USING (
  user_id = auth.uid()
  OR is_curated  -- kuratierte Routen sind redaktionell und immer öffentlich
  OR (
    is_published
    AND NOT is_blocked(auth.uid(), user_id)
  )
);

-- ─── 1. Abzeichen ────────────────────────────────────────────
DROP POLICY IF EXISTS "user_badges_read_public" ON user_badges;

DROP POLICY IF EXISTS user_badges_select ON user_badges;
CREATE POLICY user_badges_select ON user_badges FOR SELECT USING (
  user_id = auth.uid()
  OR NOT is_blocked(auth.uid(), user_id)
);

-- ─── 1. Challenge-Teilnahmen ─────────────────────────────────
-- Die Rangliste läuft über get_challenge_leaderboard (SECURITY DEFINER).
DROP POLICY IF EXISTS "challenge_participants_read" ON challenge_participants;

DROP POLICY IF EXISTS challenge_participants_select ON challenge_participants;
CREATE POLICY challenge_participants_select ON challenge_participants FOR SELECT USING (
  user_id = auth.uid()
  OR (
    auth.uid() IS NOT NULL
    AND NOT is_blocked(auth.uid(), user_id)
  )
);

-- ─── 2. Feste Suchpfade ──────────────────────────────────────
-- 002
ALTER FUNCTION is_blocked(UUID, UUID) SET search_path = public;
ALTER FUNCTION is_following(UUID, UUID) SET search_path = public;
ALTER FUNCTION is_mutual_follow(UUID, UUID) SET search_path = public;
ALTER FUNCTION is_group_member(UUID, UUID) SET search_path = public;
ALTER FUNCTION is_community_member(UUID, UUID) SET search_path = public;

-- 004
ALTER FUNCTION update_likes_count() SET search_path = public;
ALTER FUNCTION update_comments_count() SET search_path = public;
ALTER FUNCTION update_saves_count() SET search_path = public;
ALTER FUNCTION check_report_threshold() SET search_path = public;

-- 005
ALTER FUNCTION check_mutual_follow(UUID, UUID) SET search_path = public;
ALTER FUNCTION get_blocked_user_ids(UUID) SET search_path = public;
ALTER FUNCTION notify_new_follower() SET search_path = public;
ALTER FUNCTION notify_new_dm() SET search_path = public;
ALTER FUNCTION notify_follow_request() SET search_path = public;
ALTER FUNCTION notify_group_event() SET search_path = public;

-- 006
ALTER FUNCTION upvote_trail_condition(UUID) SET search_path = public;
ALTER FUNCTION check_trail_reporter_badges() SET search_path = public;
ALTER FUNCTION notify_bookmarked_route_condition() SET search_path = public;

-- 007
ALTER FUNCTION award_badge(UUID, VARCHAR) SET search_path = public;
ALTER FUNCTION get_user_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public;
ALTER FUNCTION get_monthly_activity(UUID, INTEGER) SET search_path = public;
ALTER FUNCTION get_personal_records(UUID) SET search_path = public;
ALTER FUNCTION update_challenge_progress(UUID, UUID, FLOAT) SET search_path = public;
ALTER FUNCTION get_challenge_leaderboard(UUID, INTEGER) SET search_path = public;
-- Nutzt ST_X/ST_Y; auf gehostetem Supabase liegt PostGIS evtl. im Schema
-- extensions. Ein fehlendes Schema im Suchpfad wird von Postgres ignoriert.
ALTER FUNCTION get_live_tracking_by_token(VARCHAR) SET search_path = public, extensions;
