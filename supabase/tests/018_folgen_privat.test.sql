-- Test für Migration 018. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: P = privates Profil, O = öffentliches Profil, F = möchte folgen

BEGIN;

INSERT INTO users (id, username, is_private) VALUES
  ('00000000-0000-0000-0000-0000000018a1', 'test_18_privat', TRUE),
  ('00000000-0000-0000-0000-0000000018b2', 'test_18_offen', FALSE),
  ('00000000-0000-0000-0000-0000000018c3', 'test_18_fan', FALSE);
INSERT INTO posts (id, user_id, content) VALUES
  ('00000000-0000-0000-0000-00000000f018', '00000000-0000-0000-0000-0000000018a1', 'Nur für Follower');

-- ── F: direkt folgen nur bei öffentlichen Profilen ──────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000018c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO follows (follower_id, following_id) VALUES
      ('00000000-0000-0000-0000-0000000018c3', '00000000-0000-0000-0000-0000000018a1');
    RAISE EXCEPTION 'FEHLER: privatem Profil ohne Anfrage gefolgt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: privatem Profil direkt folgen abgelehnt';
  END;

  BEGIN
    INSERT INTO follows (follower_id, following_id) VALUES
      ('00000000-0000-0000-0000-0000000018c3', '00000000-0000-0000-0000-0000000018c3');
    RAISE EXCEPTION 'FEHLER: sich selbst gefolgt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: sich selbst folgen abgelehnt';
  END;

  BEGIN
    INSERT INTO follow_requests (requester_id, target_id, status) VALUES
      ('00000000-0000-0000-0000-0000000018c3', '00000000-0000-0000-0000-0000000018a1', 'accepted');
    RAISE EXCEPTION 'FEHLER: selbst angenommene Folge-Anfrage angelegt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Anfrage nur als pending';
  END;

  INSERT INTO follows (follower_id, following_id) VALUES
    ('00000000-0000-0000-0000-0000000018c3', '00000000-0000-0000-0000-0000000018b2');
  INSERT INTO follow_requests (requester_id, target_id) VALUES
    ('00000000-0000-0000-0000-0000000018c3', '00000000-0000-0000-0000-0000000018a1');

  IF EXISTS (SELECT 1 FROM posts WHERE id = '00000000-0000-0000-0000-00000000f018') THEN
    RAISE EXCEPTION 'FEHLER: privater Beitrag vor der Annahme sichtbar';
  END IF;
  RAISE NOTICE 'ok: öffentlichem Profil gefolgt, Anfrage an privates gestellt';
END $$;

-- ── P: Paar umschreiben scheitert, Annahme legt Folge an ────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000018a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    UPDATE follow_requests
    SET requester_id = '00000000-0000-0000-0000-0000000018b2', status = 'accepted'
    WHERE requester_id = '00000000-0000-0000-0000-0000000018c3'
      AND target_id = '00000000-0000-0000-0000-0000000018a1';
    RAISE EXCEPTION 'FEHLER: Folge-Anfrage auf andere Person umgeschrieben';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Anfrage lässt sich nicht umschreiben';
  END;

  -- wie useFollow seit dieser Migration: nur den Status setzen
  UPDATE follow_requests SET status = 'accepted'
  WHERE requester_id = '00000000-0000-0000-0000-0000000018c3'
    AND target_id = '00000000-0000-0000-0000-0000000018a1'
    AND status = 'pending';
END $$;

-- ── F: folgt jetzt und sieht den Beitrag; entfolgen räumt auf ──
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000018c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = '00000000-0000-0000-0000-0000000018c3'
      AND following_id = '00000000-0000-0000-0000-0000000018a1'
  ) THEN
    RAISE EXCEPTION 'FEHLER: Annahme hat keine Folge angelegt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = '00000000-0000-0000-0000-00000000f018') THEN
    RAISE EXCEPTION 'FEHLER: Beitrag nach der Annahme nicht sichtbar';
  END IF;
  RAISE NOTICE 'ok: Annahme legt Folge an, Beitrag sichtbar';

  DELETE FROM follows
  WHERE follower_id = '00000000-0000-0000-0000-0000000018c3'
    AND following_id = '00000000-0000-0000-0000-0000000018a1';
  IF EXISTS (
    SELECT 1 FROM follow_requests
    WHERE requester_id = '00000000-0000-0000-0000-0000000018c3'
      AND target_id = '00000000-0000-0000-0000-0000000018a1'
  ) THEN
    RAISE EXCEPTION 'FEHLER: Anfrage blieb nach dem Entfolgen stehen';
  END IF;

  INSERT INTO follow_requests (requester_id, target_id) VALUES
    ('00000000-0000-0000-0000-0000000018c3', '00000000-0000-0000-0000-0000000018a1');
  RAISE NOTICE 'ok: nach dem Entfolgen ist eine neue Anfrage möglich';
END $$;

-- ── P: Ablehnen löscht die Anfrage, F kann wieder anfragen ──
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000018a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DELETE FROM follow_requests
WHERE requester_id = '00000000-0000-0000-0000-0000000018c3'
  AND target_id = '00000000-0000-0000-0000-0000000018a1';

RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000018c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  INSERT INTO follow_requests (requester_id, target_id) VALUES
    ('00000000-0000-0000-0000-0000000018c3', '00000000-0000-0000-0000-0000000018a1');
  IF EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = '00000000-0000-0000-0000-0000000018c3'
      AND following_id = '00000000-0000-0000-0000-0000000018a1'
  ) THEN
    RAISE EXCEPTION 'FEHLER: abgelehnte Person folgt trotzdem';
  END IF;
  RAISE NOTICE 'ok: nach dem Ablehnen neue Anfrage möglich, keine Folge';
END $$;

RESET ROLE;
ROLLBACK;
