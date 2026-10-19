-- Test für Migration 014. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: A = Blockierender, B = von A blockiert, C = Drittes Konto

BEGIN;

INSERT INTO users (id, username) VALUES
  ('00000000-0000-0000-0000-0000000014a1', 'test_bl_blocker'),
  ('00000000-0000-0000-0000-0000000014b2', 'test_bl_blocked'),
  ('00000000-0000-0000-0000-0000000014c3', 'test_bl_third');
INSERT INTO blocks (blocker_id, blocked_id) VALUES
  ('00000000-0000-0000-0000-0000000014a1', '00000000-0000-0000-0000-0000000014b2');
INSERT INTO routes (id, user_id, title, is_published) VALUES
  ('00000000-0000-0000-0000-0000000014f1', '00000000-0000-0000-0000-0000000014a1',
   'Testroute', TRUE);
INSERT INTO challenges (id, title) VALUES
  ('00000000-0000-0000-0000-0000000014e1', 'Testchallenge');
INSERT INTO user_badges (user_id, badge_id) VALUES
  ('00000000-0000-0000-0000-0000000014a1', 'first_summit');
INSERT INTO challenge_participants (challenge_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000014e1', '00000000-0000-0000-0000-0000000014a1');

-- ── B (blockiert): sieht nichts von A ───────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000014b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM routes
             WHERE user_id = '00000000-0000-0000-0000-0000000014a1') THEN
    RAISE EXCEPTION 'FEHLER: blockiertes Konto sieht Route des Blockierenden';
  END IF;
  IF EXISTS (SELECT 1 FROM user_badges
             WHERE user_id = '00000000-0000-0000-0000-0000000014a1') THEN
    RAISE EXCEPTION 'FEHLER: blockiertes Konto sieht Abzeichen des Blockierenden';
  END IF;
  IF EXISTS (SELECT 1 FROM challenge_participants
             WHERE user_id = '00000000-0000-0000-0000-0000000014a1') THEN
    RAISE EXCEPTION 'FEHLER: blockiertes Konto sieht Challenge-Teilnahme des Blockierenden';
  END IF;
  RAISE NOTICE 'ok: blockiertes Konto sieht weder Route noch Abzeichen noch Teilnahme';
END $$;

-- ── C (drittes Konto): sieht alles Öffentliche von A ────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000014c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM routes
                 WHERE id = '00000000-0000-0000-0000-0000000014f1') THEN
    RAISE EXCEPTION 'FEHLER: drittes Konto sieht veröffentlichte Route nicht';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_badges
                 WHERE user_id = '00000000-0000-0000-0000-0000000014a1') THEN
    RAISE EXCEPTION 'FEHLER: drittes Konto sieht Abzeichen nicht';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM challenge_participants
                 WHERE user_id = '00000000-0000-0000-0000-0000000014a1') THEN
    RAISE EXCEPTION 'FEHLER: drittes Konto sieht Challenge-Teilnahme nicht';
  END IF;
  RAISE NOTICE 'ok: drittes Konto sieht Route, Abzeichen und Teilnahme';
END $$;

-- ── A: eigene Zeilen bleiben sichtbar ───────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000014a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM routes
                 WHERE id = '00000000-0000-0000-0000-0000000014f1')
     OR NOT EXISTS (SELECT 1 FROM user_badges
                    WHERE user_id = '00000000-0000-0000-0000-0000000014a1')
     OR NOT EXISTS (SELECT 1 FROM challenge_participants
                    WHERE user_id = '00000000-0000-0000-0000-0000000014a1') THEN
    RAISE EXCEPTION 'FEHLER: eigene Zeilen nicht mehr sichtbar';
  END IF;
  RAISE NOTICE 'ok: eigene Zeilen sichtbar';
END $$;

RESET ROLE;

-- ── Keine SECURITY-DEFINER-Funktion ohne festen Suchpfad ────
DO $$
DECLARE offen TEXT;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO offen
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) AS c
      WHERE c LIKE 'search_path=%'
    )
    -- Funktionen aus Extensions (PostGIS, pgRouting) gehören nicht uns
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
    );
  IF offen IS NOT NULL THEN
    RAISE EXCEPTION 'FEHLER: SECURITY DEFINER ohne search_path: %', offen;
  END IF;
  RAISE NOTICE 'ok: alle SECURITY-DEFINER-Funktionen haben einen festen Suchpfad';
END $$;

ROLLBACK;
