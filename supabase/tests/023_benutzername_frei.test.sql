-- Test für Migration 023. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: A = prüft Namen, P = privat, A folgt P nicht

BEGIN;

INSERT INTO users (id, username, is_private) VALUES
  ('00000000-0000-0000-0000-0000000023a1', 'test_23_a', FALSE),
  ('00000000-0000-0000-0000-0000000023b2', 'test_23_privat', TRUE);

SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000023a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF NOT is_username_available('test_23_frei') THEN
    RAISE EXCEPTION 'FEHLER: freier Name als vergeben gemeldet';
  END IF;
  RAISE NOTICE 'ok: freier Name ist frei';

  IF EXISTS (SELECT 1 FROM users WHERE username = 'test_23_privat') THEN
    RAISE EXCEPTION 'FEHLER: privates Konto für Nicht-Follower sichtbar, Test sinnlos';
  END IF;
  IF is_username_available('test_23_privat') THEN
    RAISE EXCEPTION 'FEHLER: Name eines privaten Kontos als frei gemeldet';
  END IF;
  RAISE NOTICE 'ok: Name eines privaten Kontos ist vergeben';

  IF is_username_available('Test_23_Privat') THEN
    RAISE EXCEPTION 'FEHLER: anders geschriebener Name als frei gemeldet';
  END IF;
  RAISE NOTICE 'ok: Gross-/Kleinschreibung zählt nicht';

  IF NOT is_username_available('test_23_a') THEN
    RAISE EXCEPTION 'FEHLER: eigener Name als vergeben gemeldet';
  END IF;
  RAISE NOTICE 'ok: eigener Name ist frei';

  IF is_username_available('ab')
     OR is_username_available('test 23')
     OR is_username_available('Test_23_neu')
     OR is_username_available('test_23_ä') THEN
    RAISE EXCEPTION 'FEHLER: ungültiges Format als frei gemeldet';
  END IF;
  RAISE NOTICE 'ok: ungültiges Format ist nie frei';
END $$;

-- ── anon: kein Aufruf ohne Login ────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;

DO $$
BEGIN
  PERFORM is_username_available('test_23_frei');
  RAISE EXCEPTION 'FEHLER: anonymer Aufruf erlaubt';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok: anonymer Aufruf abgelehnt';
END $$;

RESET ROLE;
ROLLBACK;
