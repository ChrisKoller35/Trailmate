-- Test für Migration 021. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: W = wandert und teilt, A = alte Sitzung, X = fremde Person

BEGIN;

INSERT INTO users (id, username, display_name) VALUES
  ('00000000-0000-0000-0000-0000000021a1', 'test_21_wandert', 'Wanda Test'),
  ('00000000-0000-0000-0000-0000000021b2', 'test_21_alt', NULL),
  ('00000000-0000-0000-0000-0000000021c3', 'test_21_fremd', NULL);

-- A: Sitzung, die vor 49 Stunden gestartet wurde
DO $$
DECLARE
  v_token TEXT;
BEGIN
  INSERT INTO live_tracking_sessions (user_id, share_token, started_at)
  VALUES ('00000000-0000-0000-0000-0000000021b2', 'alt', NOW() - INTERVAL '49 hours')
  RETURNING share_token INTO v_token;
  PERFORM set_config('test.token_alt', v_token, true);
END $$;

-- ── W: Client-Token wird ersetzt, zweite Sitzung beendet die erste ──
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_first_id UUID;
  v_first TEXT;
  v_second TEXT;
BEGIN
  INSERT INTO live_tracking_sessions (user_id, share_token, update_interval_minutes)
  VALUES ('00000000-0000-0000-0000-0000000021a1', 'vom-client-gewaehlt', 10)
  RETURNING id, share_token INTO v_first_id, v_first;

  IF v_first = 'vom-client-gewaehlt' OR length(v_first) <> 32 OR v_first !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'FEHLER: Client-Token nicht ersetzt (%)', v_first;
  END IF;
  RAISE NOTICE 'ok: Server setzt das Token';

  BEGIN
    UPDATE live_tracking_sessions SET share_token = 'neu' WHERE id = v_first_id;
    RAISE EXCEPTION 'FEHLER: Token nachträglich geändert';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Token lässt sich nicht ändern';
  END;

  INSERT INTO live_tracking_sessions (user_id, update_interval_minutes)
  VALUES ('00000000-0000-0000-0000-0000000021a1', 5)
  RETURNING share_token INTO v_second;

  IF (SELECT is_active FROM live_tracking_sessions WHERE id = v_first_id) THEN
    RAISE EXCEPTION 'FEHLER: erste Sitzung bleibt nach dem Neustart aktiv';
  END IF;
  IF (SELECT count(*) FROM live_tracking_sessions
      WHERE user_id = '00000000-0000-0000-0000-0000000021a1' AND is_active) <> 1 THEN
    RAISE EXCEPTION 'FEHLER: nicht genau eine aktive Sitzung';
  END IF;
  RAISE NOTICE 'ok: zweite Sitzung beendet die erste';

  UPDATE live_tracking_sessions
  SET last_location = ST_SetSRID(ST_MakePoint(7.65, 46.55), 4326),
      last_updated_at = NOW()
  WHERE share_token = v_second;

  PERFORM set_config('test.token_first', v_first, true);
  PERFORM set_config('test.token_second', v_second, true);
END $$;

-- ── X: fremde Person kann die Sitzung nicht ändern ──────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000021c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

UPDATE live_tracking_sessions
SET is_active = FALSE,
    last_location = ST_SetSRID(ST_MakePoint(0, 0), 4326)
WHERE share_token = current_setting('test.token_second');

RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM live_tracking_sessions
    WHERE share_token = current_setting('test.token_second')
      AND is_active
      AND ST_X(last_location) = 7.65
  ) THEN
    RAISE EXCEPTION 'FEHLER: fremde Person hat die Sitzung geändert';
  END IF;
  RAISE NOTICE 'ok: fremde Person ändert nichts';
END $$;

-- ── anon: liest per Token Name und Standort ─────────────────
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;

DO $$
DECLARE
  v JSON;
BEGIN
  v := get_live_tracking_by_token(current_setting('test.token_second'));
  IF v IS NULL THEN
    RAISE EXCEPTION 'FEHLER: aktive Sitzung per Token nicht lesbar';
  END IF;
  IF v->>'display_name' IS DISTINCT FROM 'Wanda Test' THEN
    RAISE EXCEPTION 'FEHLER: display_name falsch (%)', v->>'display_name';
  END IF;
  IF (v->'last_location'->>'longitude')::float <> 7.65
     OR (v->'last_location'->>'latitude')::float <> 46.55 THEN
    RAISE EXCEPTION 'FEHLER: Standort falsch (%)', v->'last_location';
  END IF;
  IF v->>'last_updated_at' IS NULL OR v->>'started_at' IS NULL THEN
    RAISE EXCEPTION 'FEHLER: Zeitangaben fehlen';
  END IF;
  RAISE NOTICE 'ok: anon liest Name und Standort';

  IF get_live_tracking_by_token(current_setting('test.token_first')) IS NOT NULL THEN
    RAISE EXCEPTION 'FEHLER: beendete Sitzung noch lesbar';
  END IF;
  RAISE NOTICE 'ok: beendete Sitzung liefert NULL';

  IF get_live_tracking_by_token(current_setting('test.token_alt')) IS NOT NULL THEN
    RAISE EXCEPTION 'FEHLER: 49 Stunden alte Sitzung noch lesbar';
  END IF;
  RAISE NOTICE 'ok: 49 Stunden alte Sitzung liefert NULL';

  IF get_live_tracking_by_token('gibt-es-nicht') IS NOT NULL THEN
    RAISE EXCEPTION 'FEHLER: unbekanntes Token liefert etwas';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;
