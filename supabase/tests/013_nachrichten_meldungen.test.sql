-- Test für Migration 013. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
--
-- A besitzt den Beitrag, B schreibt A, C ist unbeteiligt, D meldet zusätzlich.

BEGIN;

INSERT INTO users (id, username) VALUES
  ('00000000-0000-0000-0000-0000000013a1', 'test_msg_a'),
  ('00000000-0000-0000-0000-0000000013b2', 'test_msg_b'),
  ('00000000-0000-0000-0000-0000000013c3', 'test_msg_c'),
  ('00000000-0000-0000-0000-0000000013d4', 'test_msg_d');
INSERT INTO posts (id, user_id, content) VALUES
  ('00000000-0000-0000-0000-00000000130a', '00000000-0000-0000-0000-0000000013a1', 'Testbeitrag');

SET LOCAL ROLE authenticated;

-- 1) B schreibt an C (nicht Besitzer) → scheitert; an A (Besitzer) → gelingt
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000013b2","role":"authenticated"}', true);
DO $$
BEGIN
  BEGIN
    INSERT INTO post_messages (post_id, sender_id, receiver_id, content) VALUES
      ('00000000-0000-0000-0000-00000000130a', '00000000-0000-0000-0000-0000000013b2',
       '00000000-0000-0000-0000-0000000013c3', 'Hallo C');
    RAISE EXCEPTION 'FEHLER: Nachricht an Nicht-Besitzer wurde angenommen';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Nachricht an Nicht-Besitzer abgelehnt';
  END;

  INSERT INTO post_messages (post_id, sender_id, receiver_id, content) VALUES
    ('00000000-0000-0000-0000-00000000130a', '00000000-0000-0000-0000-0000000013b2',
     '00000000-0000-0000-0000-0000000013a1', 'Hallo A, gehst du mit?');
  RAISE NOTICE 'ok: Nachricht an Besitzer angenommen';
END $$;

-- 2) A antwortet B → gelingt; A schreibt C (hat nie geschrieben) → scheitert
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000013a1","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO post_messages (post_id, sender_id, receiver_id, content) VALUES
    ('00000000-0000-0000-0000-00000000130a', '00000000-0000-0000-0000-0000000013a1',
     '00000000-0000-0000-0000-0000000013b2', 'Gerne!');
  RAISE NOTICE 'ok: Antwort des Besitzers angenommen';

  BEGIN
    INSERT INTO post_messages (post_id, sender_id, receiver_id, content) VALUES
      ('00000000-0000-0000-0000-00000000130a', '00000000-0000-0000-0000-0000000013a1',
       '00000000-0000-0000-0000-0000000013c3', 'Ungefragt');
    RAISE EXCEPTION 'FEHLER: Besitzer konnte ungefragt an C schreiben';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Besitzer kann nur antworten';
  END;
END $$;

-- 3) Tageslimit: nach 50 Nachrichten ist Schluss
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000013c3","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO post_messages (post_id, sender_id, receiver_id, content)
  SELECT '00000000-0000-0000-0000-00000000130a', '00000000-0000-0000-0000-0000000013c3',
         '00000000-0000-0000-0000-0000000013a1', 'Nachricht ' || i
  FROM generate_series(1, 50) AS i;

  BEGIN
    INSERT INTO post_messages (post_id, sender_id, receiver_id, content) VALUES
      ('00000000-0000-0000-0000-00000000130a', '00000000-0000-0000-0000-0000000013c3',
       '00000000-0000-0000-0000-0000000013a1', 'Nummer 51');
    RAISE EXCEPTION 'FEHLER: 51. Nachricht innerhalb 24 h angenommen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'ok: Tageslimit greift';
  END;
END $$;

-- 4) Meldungen: B meldet zweimal → zweite scheitert
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000013b2","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO reports (reporter_id, post_id, reason) VALUES
    ('00000000-0000-0000-0000-0000000013b2', '00000000-0000-0000-0000-00000000130a', 'spam');
  BEGIN
    INSERT INTO reports (reporter_id, post_id, reason) VALUES
      ('00000000-0000-0000-0000-0000000013b2', '00000000-0000-0000-0000-00000000130a', 'abuse');
    RAISE EXCEPTION 'FEHLER: doppelte Meldung angenommen';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'ok: doppelte Meldung abgelehnt';
  END;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT is_hidden FROM posts WHERE id = '00000000-0000-0000-0000-00000000130a') THEN
    RAISE EXCEPTION 'FEHLER: Beitrag nach einer Meldung bereits ausgeblendet';
  END IF;
END $$;

-- 5) C und D melden ebenfalls → drei Meldende blenden den Beitrag aus
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000013c3","role":"authenticated"}', true);
INSERT INTO reports (reporter_id, post_id, reason) VALUES
  ('00000000-0000-0000-0000-0000000013c3', '00000000-0000-0000-0000-00000000130a', 'spam');
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000013d4","role":"authenticated"}', true);
INSERT INTO reports (reporter_id, post_id, reason) VALUES
  ('00000000-0000-0000-0000-0000000013d4', '00000000-0000-0000-0000-00000000130a', 'spam');

RESET ROLE;
DO $$
BEGIN
  IF NOT (SELECT is_hidden FROM posts WHERE id = '00000000-0000-0000-0000-00000000130a') THEN
    RAISE EXCEPTION 'FEHLER: Beitrag nach drei Meldenden nicht ausgeblendet';
  END IF;
  IF (SELECT report_count FROM posts WHERE id = '00000000-0000-0000-0000-00000000130a') <> 3 THEN
    RAISE EXCEPTION 'FEHLER: report_count ist nicht 3';
  END IF;
  RAISE NOTICE 'ok: drei Meldende blenden den Beitrag aus';
END $$;

ROLLBACK;
