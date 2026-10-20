-- Test für Migration 015. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
--
-- A schreibt Beiträge, A und B folgen sich gegenseitig und schreiben sich.

BEGIN;

INSERT INTO users (id, username) VALUES
  ('00000000-0000-0000-0000-0000000015a1', 'test_limit_a'),
  ('00000000-0000-0000-0000-0000000015b2', 'test_limit_b');
INSERT INTO follows (follower_id, following_id) VALUES
  ('00000000-0000-0000-0000-0000000015a1', '00000000-0000-0000-0000-0000000015b2'),
  ('00000000-0000-0000-0000-0000000015b2', '00000000-0000-0000-0000-0000000015a1');

-- Vorbereitung ohne auth.uid(): created_at darf gesetzt werden.
-- 4 Beiträge in der letzten Stunde, 1 älterer (zählt nicht), 1 von gestern
-- mit Text „Alt“ (älter als 24 h, darf wiederholt werden).
INSERT INTO posts (user_id, content, created_at)
SELECT '00000000-0000-0000-0000-0000000015a1', 'Vorbereitet ' || i,
       NOW() - (i * INTERVAL '10 minutes')
FROM generate_series(1, 4) AS i;
INSERT INTO posts (user_id, content, created_at) VALUES
  ('00000000-0000-0000-0000-0000000015a1', 'Vor zwei Stunden', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0000-0000000015a1', 'Alt', NOW() - INTERVAL '25 hours');

-- 49 Direktnachrichten von A in den letzten 24 h, 5 ältere (zählen nicht)
INSERT INTO direct_messages (sender_id, receiver_id, content, created_at)
SELECT '00000000-0000-0000-0000-0000000015a1', '00000000-0000-0000-0000-0000000015b2',
       'Nachricht ' || i, NOW() - (i * INTERVAL '20 minutes')
FROM generate_series(1, 49) AS i;
INSERT INTO direct_messages (sender_id, receiver_id, content, created_at)
SELECT '00000000-0000-0000-0000-0000000015a1', '00000000-0000-0000-0000-0000000015b2',
       'Alt ' || i, NOW() - INTERVAL '25 hours'
FROM generate_series(1, 5) AS i;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000015a1","role":"authenticated"}', true);

-- 1) Duplikat-Sperre: gleicher Text wie vor 10 Minuten scheitert;
--    Text von vor 25 h und leerer Text sind erlaubt (5. Beitrag der Stunde)
DO $$
BEGIN
  BEGIN
    INSERT INTO posts (user_id, content) VALUES
      ('00000000-0000-0000-0000-0000000015a1', '  Vorbereitet 1 ');
    RAISE EXCEPTION 'FEHLER: gleicher Text innerhalb 24 h angenommen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok: Duplikat abgelehnt';
  END;

  INSERT INTO posts (user_id, content) VALUES
    ('00000000-0000-0000-0000-0000000015a1', 'Alt');
  RAISE NOTICE 'ok: Text nach 24 h wieder erlaubt (5. Beitrag)';
END $$;

-- 2) Stundenlimit: der 6. Beitrag scheitert, auch mit zurückdatiertem
--    created_at und ohne Text
DO $$
BEGIN
  BEGIN
    INSERT INTO posts (user_id, content, created_at) VALUES
      ('00000000-0000-0000-0000-0000000015a1', 'Nummer 6', NOW() - INTERVAL '3 hours');
    RAISE EXCEPTION 'FEHLER: 6. Beitrag innerhalb einer Stunde angenommen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok: Stundenlimit greift';
  END;

  BEGIN
    INSERT INTO posts (user_id, content) VALUES
      ('00000000-0000-0000-0000-0000000015a1', NULL);
    RAISE EXCEPTION 'FEHLER: 6. Beitrag ohne Text angenommen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok: Stundenlimit gilt auch ohne Text';
  END;
END $$;

-- 3) Tageslimit Direktnachrichten: die 50. gelingt, die 51. scheitert
DO $$
BEGIN
  INSERT INTO direct_messages (sender_id, receiver_id, content, created_at) VALUES
    ('00000000-0000-0000-0000-0000000015a1', '00000000-0000-0000-0000-0000000015b2',
     'Nummer 50', NOW() - INTERVAL '3 days');
  RAISE NOTICE 'ok: 50. Direktnachricht angenommen';

  BEGIN
    INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES
      ('00000000-0000-0000-0000-0000000015a1', '00000000-0000-0000-0000-0000000015b2',
       'Nummer 51');
    RAISE EXCEPTION 'FEHLER: 51. Direktnachricht innerhalb 24 h angenommen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok: Tageslimit Direktnachrichten greift';
  END;
END $$;

-- 4) B ist vom Limit von A nicht betroffen
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000015b2","role":"authenticated"}', true);
INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES
  ('00000000-0000-0000-0000-0000000015b2', '00000000-0000-0000-0000-0000000015a1', 'Hallo A');

RESET ROLE;
DO $$
BEGIN
  -- Zurückdatierte 50. Nachricht wurde auf NOW() gesetzt
  IF (SELECT created_at FROM direct_messages WHERE content = 'Nummer 50'
        AND sender_id = '00000000-0000-0000-0000-0000000015a1') < NOW() - INTERVAL '1 minute' THEN
    RAISE EXCEPTION 'FEHLER: Client konnte created_at zurückdatieren';
  END IF;
  RAISE NOTICE 'ok: created_at vom Server gesetzt';
END $$;

ROLLBACK;
