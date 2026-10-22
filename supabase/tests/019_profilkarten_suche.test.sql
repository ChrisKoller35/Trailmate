-- Test für Migration 019. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: S = sucht, P = privates Profil, B = von S blockiert,
--         C = hat S blockiert, X = Name mit Prozentzeichen

BEGIN;

INSERT INTO users (id, username, display_name, is_private) VALUES
  ('00000000-0000-0000-0000-0000000019a1', 'test_19_sucher', 'Suchende Person', FALSE),
  ('00000000-0000-0000-0000-0000000019b2', 'test_19_privat', 'Bergfreundin Zwölf', TRUE),
  ('00000000-0000-0000-0000-0000000019c3', 'test_19_blockiert', 'Bergfreund Blockiert', FALSE),
  ('00000000-0000-0000-0000-0000000019d4', 'test_19_blockiert_mich', 'Bergfreund Sperrt', FALSE),
  ('00000000-0000-0000-0000-0000000019e5', 'test_19_prozent', '100% Gipfel', FALSE);
INSERT INTO blocks (blocker_id, blocked_id) VALUES
  ('00000000-0000-0000-0000-0000000019a1', '00000000-0000-0000-0000-0000000019c3'),
  ('00000000-0000-0000-0000-0000000019d4', '00000000-0000-0000-0000-0000000019a1');

-- ── S: Karten und Suche ─────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count INT;
  v_private BOOLEAN;
BEGIN
  SELECT c.is_private INTO v_private
  FROM get_profile_cards(ARRAY['00000000-0000-0000-0000-0000000019b2']::UUID[]) c;
  IF v_private IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'FEHLER: privates Profil liefert keine Karte';
  END IF;
  RAISE NOTICE 'ok: privates Profil liefert eine Karte';

  SELECT count(*) INTO v_count
  FROM get_profile_cards(ARRAY[
    '00000000-0000-0000-0000-0000000019c3',
    '00000000-0000-0000-0000-0000000019d4'
  ]::UUID[]);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FEHLER: blockierte Person liefert eine Karte (% Karten)', v_count;
  END IF;
  RAISE NOTICE 'ok: keine Karte bei Blockierung in beide Richtungen';

  IF NOT EXISTS (
    SELECT 1 FROM search_profiles('freundin')
    WHERE id = '00000000-0000-0000-0000-0000000019b2'
  ) THEN
    RAISE EXCEPTION 'FEHLER: Suche findet Teilwort im Anzeigenamen nicht';
  END IF;
  RAISE NOTICE 'ok: Suche per Teilwort im Anzeigenamen';

  IF EXISTS (
    SELECT 1 FROM search_profiles('bergfreund')
    WHERE id IN ('00000000-0000-0000-0000-0000000019c3', '00000000-0000-0000-0000-0000000019d4')
  ) THEN
    RAISE EXCEPTION 'FEHLER: Suche liefert blockierte Personen';
  END IF;
  IF EXISTS (
    SELECT 1 FROM search_profiles('test_19')
    WHERE id = '00000000-0000-0000-0000-0000000019a1'
  ) THEN
    RAISE EXCEPTION 'FEHLER: Suche liefert die suchende Person selbst';
  END IF;
  RAISE NOTICE 'ok: Suche ohne Blockierte und ohne sich selbst';

  -- 'g%l' würde mit % als Platzhalter z. B. «Bergfreundin Zwölf» treffen
  SELECT count(*) INTO v_count FROM search_profiles('g%l');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FEHLER: %% wirkt als Platzhalter (% Treffer)', v_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM search_profiles('0% g')
    WHERE id = '00000000-0000-0000-0000-0000000019e5'
  ) THEN
    RAISE EXCEPTION 'FEHLER: wörtliches %% wird nicht gefunden';
  END IF;
  RAISE NOTICE 'ok: Prozentzeichen wird wörtlich gesucht';

  SELECT count(*) INTO v_count FROM search_profiles(' b ');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FEHLER: 1 Zeichen liefert % Treffer', v_count;
  END IF;
  RAISE NOTICE 'ok: 1 Zeichen liefert nichts';

  IF (SELECT id FROM search_profiles('test_19_privat') LIMIT 1)
     IS DISTINCT FROM '00000000-0000-0000-0000-0000000019b2' THEN
    RAISE EXCEPTION 'FEHLER: exakter Username steht nicht zuoberst';
  END IF;
  RAISE NOTICE 'ok: exakter Username zuerst';
END $$;

-- ── anon: kein Aufruf erlaubt ───────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM get_profile_cards(ARRAY['00000000-0000-0000-0000-0000000019b2']::UUID[]);
    RAISE EXCEPTION 'FEHLER: anon darf get_profile_cards aufrufen';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: anon darf get_profile_cards nicht aufrufen';
  END;

  BEGIN
    PERFORM search_profiles('bergfreund');
    RAISE EXCEPTION 'FEHLER: anon darf search_profiles aufrufen';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: anon darf search_profiles nicht aufrufen';
  END;
END $$;

RESET ROLE;
ROLLBACK;
