-- Test für Migration 022. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: A = Verfasser, B und C = stimmen ab, D = von A blockiert

BEGIN;

INSERT INTO users (id, username) VALUES
  ('00000000-0000-0000-0000-0000000022a1', 'test_22_autor'),
  ('00000000-0000-0000-0000-0000000022b2', 'test_22_b'),
  ('00000000-0000-0000-0000-0000000022c3', 'test_22_c'),
  ('00000000-0000-0000-0000-0000000022d4', 'test_22_blockiert');
INSERT INTO blocks (blocker_id, blocked_id) VALUES
  ('00000000-0000-0000-0000-0000000022a1', '00000000-0000-0000-0000-0000000022d4');
INSERT INTO trail_conditions (id, user_id, comment) VALUES
  ('00000000-0000-0000-0000-00000000c022', '00000000-0000-0000-0000-0000000022a1', 'Weg offen');

-- ── B: erste Stimme zählt, zweite nicht ─────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000022b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF NOT upvote_trail_condition('00000000-0000-0000-0000-00000000c022')
     OR (SELECT helpfulness_score FROM trail_conditions
         WHERE id = '00000000-0000-0000-0000-00000000c022') <> 1 THEN
    RAISE EXCEPTION 'FEHLER: erste Stimme nicht gezählt';
  END IF;
  RAISE NOTICE 'ok: erste Stimme zählt';

  IF upvote_trail_condition('00000000-0000-0000-0000-00000000c022')
     OR (SELECT helpfulness_score FROM trail_conditions
         WHERE id = '00000000-0000-0000-0000-00000000c022') <> 1 THEN
    RAISE EXCEPTION 'FEHLER: zweite Stimme derselben Person gezählt';
  END IF;
  RAISE NOTICE 'ok: zweite Stimme derselben Person ändert nichts';
END $$;

-- ── C: zweite Person, sieht nur die eigene Stimme ───────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000022c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM upvote_trail_condition('00000000-0000-0000-0000-00000000c022');
  IF (SELECT helpfulness_score FROM trail_conditions
      WHERE id = '00000000-0000-0000-0000-00000000c022') <> 2 THEN
    RAISE EXCEPTION 'FEHLER: zweite Person bringt den Score nicht auf 2';
  END IF;
  RAISE NOTICE 'ok: zweite Person bringt den Score auf 2';

  IF (SELECT COUNT(*) FROM trail_condition_votes) <> 1
     OR EXISTS (SELECT 1 FROM trail_condition_votes
                WHERE user_id <> '00000000-0000-0000-0000-0000000022c3') THEN
    RAISE EXCEPTION 'FEHLER: fremde Stimmen sichtbar';
  END IF;
  RAISE NOTICE 'ok: nur die eigenen Stimmen sichtbar';
END $$;

-- ── D: blockiert ────────────────────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000022d4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM upvote_trail_condition('00000000-0000-0000-0000-00000000c022');
    RAISE EXCEPTION 'FEHLER: blockierte Person hat gestimmt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Stimme bei Blockierung abgelehnt';
  END;
END $$;

-- ── A: eigener Bericht, Score nicht setzbar, Text schon ─────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000022a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM upvote_trail_condition('00000000-0000-0000-0000-00000000c022');
    RAISE EXCEPTION 'FEHLER: Stimme für eigenen Bericht gezählt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Stimme für eigenen Bericht abgelehnt';
  END;

  BEGIN
    UPDATE trail_conditions SET helpfulness_score = 999
    WHERE id = '00000000-0000-0000-0000-00000000c022';
    RAISE EXCEPTION 'FEHLER: Verfasser hat den Score gesetzt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Score per UPDATE abgelehnt';
  END;

  UPDATE trail_conditions SET comment = 'Weg teilweise nass'
  WHERE id = '00000000-0000-0000-0000-00000000c022';
  IF (SELECT comment FROM trail_conditions
      WHERE id = '00000000-0000-0000-0000-00000000c022') <> 'Weg teilweise nass' THEN
    RAISE EXCEPTION 'FEHLER: Text liess sich nicht ändern';
  END IF;
  RAISE NOTICE 'ok: Verfasser kann den Text ändern';
END $$;

-- ── anon: kein Aufruf ohne Login ────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM upvote_trail_condition('00000000-0000-0000-0000-00000000c022');
    RAISE EXCEPTION 'FEHLER: anonyme Stimme gezählt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: anonymer Aufruf abgelehnt';
  END;
END $$;

RESET ROLE;
ROLLBACK;
