-- Test für Migration 016. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
--
-- A hat Likes und Kommentare eingeschaltet, B hat Likes ausdrücklich aus
-- und Kommentare nicht gesetzt (Standard: aus). C liket und kommentiert,
-- D ist von A blockiert.

BEGIN;

INSERT INTO users (id, username, notification_prefs) VALUES
  ('00000000-0000-0000-0000-0000000016a1', 'test_notif_a', '{"likes": true, "comments": true}'),
  ('00000000-0000-0000-0000-0000000016b2', 'test_notif_b', '{"likes": false}'),
  ('00000000-0000-0000-0000-0000000016c3', 'test_notif_c', '{}'),
  ('00000000-0000-0000-0000-0000000016d4', 'test_notif_d', '{}');
INSERT INTO posts (id, user_id, content) VALUES
  ('00000000-0000-0000-0000-00000000160a', '00000000-0000-0000-0000-0000000016a1', 'Beitrag von A'),
  ('00000000-0000-0000-0000-00000000160b', '00000000-0000-0000-0000-0000000016b2', 'Beitrag von B');
INSERT INTO blocks (blocker_id, blocked_id) VALUES
  ('00000000-0000-0000-0000-0000000016a1', '00000000-0000-0000-0000-0000000016d4');

-- 0) Standardwerte wie in app/notification-settings.tsx
DO $$
BEGIN
  IF wants_notification('00000000-0000-0000-0000-0000000016c3', 'likes')
     OR wants_notification('00000000-0000-0000-0000-0000000016c3', 'comments')
     OR NOT wants_notification('00000000-0000-0000-0000-0000000016c3', 'dm')
     OR NOT wants_notification('00000000-0000-0000-0000-0000000016c3', 'new_follower') THEN
    RAISE EXCEPTION 'FEHLER: Standardwerte von wants_notification stimmen nicht';
  END IF;
  RAISE NOTICE 'ok: Standardwerte';
END $$;

-- C liket und kommentiert die Beiträge von A und B
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000016c3","role":"authenticated"}', true);
INSERT INTO likes (user_id, post_id) VALUES
  ('00000000-0000-0000-0000-0000000016c3', '00000000-0000-0000-0000-00000000160a'),
  ('00000000-0000-0000-0000-0000000016c3', '00000000-0000-0000-0000-00000000160b');
INSERT INTO comments (post_id, user_id, content) VALUES
  ('00000000-0000-0000-0000-00000000160a', '00000000-0000-0000-0000-0000000016c3', 'Schöne Tour!'),
  ('00000000-0000-0000-0000-00000000160b', '00000000-0000-0000-0000-0000000016c3', 'Schöne Tour!');

-- A liket und kommentiert den eigenen Beitrag
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000016a1","role":"authenticated"}', true);
INSERT INTO likes (user_id, post_id) VALUES
  ('00000000-0000-0000-0000-0000000016a1', '00000000-0000-0000-0000-00000000160a');
INSERT INTO comments (post_id, user_id, content) VALUES
  ('00000000-0000-0000-0000-00000000160a', '00000000-0000-0000-0000-0000000016a1', 'Danke!');

-- Der blockierte D liket und kommentiert A (direkt, an RLS vorbei,
-- damit nur der Trigger geprüft wird)
RESET ROLE;
INSERT INTO likes (user_id, post_id) VALUES
  ('00000000-0000-0000-0000-0000000016d4', '00000000-0000-0000-0000-00000000160a');
INSERT INTO comments (post_id, user_id, content) VALUES
  ('00000000-0000-0000-0000-00000000160a', '00000000-0000-0000-0000-0000000016d4', 'Hallo');

DO $$
DECLARE
  n INTEGER;
BEGIN
  -- 1) Like mit Schalter an → genau eine Zeile (von C, nicht von A oder D)
  SELECT count(*) INTO n FROM notifications
  WHERE user_id = '00000000-0000-0000-0000-0000000016a1' AND type = 'like';
  IF n <> 1 THEN
    RAISE EXCEPTION 'FEHLER: % Like-Benachrichtigungen für A statt 1', n;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = '00000000-0000-0000-0000-0000000016a1' AND type = 'like'
      AND data ->> 'user_id' = '00000000-0000-0000-0000-0000000016c3'
      AND data ->> 'post_id' = '00000000-0000-0000-0000-00000000160a'
  ) THEN
    RAISE EXCEPTION 'FEHLER: Like-Benachrichtigung für A stammt nicht von C';
  END IF;
  RAISE NOTICE 'ok: Like mit Schalter an, ohne eigenen und blockierten Like';

  -- 2) Like mit Schalter aus → keine Zeile
  SELECT count(*) INTO n FROM notifications
  WHERE user_id = '00000000-0000-0000-0000-0000000016b2' AND type = 'like';
  IF n <> 0 THEN
    RAISE EXCEPTION 'FEHLER: Like-Benachrichtigung trotz Schalter aus';
  END IF;
  RAISE NOTICE 'ok: Like mit Schalter aus';

  -- 3) Kommentar mit Schalter an → genau eine Zeile (von C)
  SELECT count(*) INTO n FROM notifications
  WHERE user_id = '00000000-0000-0000-0000-0000000016a1' AND type = 'comment';
  IF n <> 1 THEN
    RAISE EXCEPTION 'FEHLER: % Kommentar-Benachrichtigungen für A statt 1', n;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = '00000000-0000-0000-0000-0000000016a1' AND type = 'comment'
      AND data ->> 'user_id' = '00000000-0000-0000-0000-0000000016c3'
  ) THEN
    RAISE EXCEPTION 'FEHLER: Kommentar-Benachrichtigung für A stammt nicht von C';
  END IF;
  RAISE NOTICE 'ok: Kommentar mit Schalter an, ohne eigenen und blockierten Kommentar';

  -- 4) Kommentar ohne gesetzten Schalter (Standard aus) → keine Zeile
  SELECT count(*) INTO n FROM notifications
  WHERE user_id = '00000000-0000-0000-0000-0000000016b2' AND type = 'comment';
  IF n <> 0 THEN
    RAISE EXCEPTION 'FEHLER: Kommentar-Benachrichtigung trotz Standard aus';
  END IF;
  RAISE NOTICE 'ok: Kommentar mit Schalter aus';
END $$;

-- 5) Bestehender Trigger: Neuer Follower respektiert den Schalter
UPDATE users SET notification_prefs = '{"new_follower": false}'
WHERE id = '00000000-0000-0000-0000-0000000016b2';
INSERT INTO follows (follower_id, following_id) VALUES
  ('00000000-0000-0000-0000-0000000016c3', '00000000-0000-0000-0000-0000000016a1'),
  ('00000000-0000-0000-0000-0000000016c3', '00000000-0000-0000-0000-0000000016b2');
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM notifications
                 WHERE user_id = '00000000-0000-0000-0000-0000000016a1' AND type = 'follow') THEN
    RAISE EXCEPTION 'FEHLER: keine Follower-Benachrichtigung trotz Standard an';
  END IF;
  IF EXISTS (SELECT 1 FROM notifications
             WHERE user_id = '00000000-0000-0000-0000-0000000016b2' AND type = 'follow') THEN
    RAISE EXCEPTION 'FEHLER: Follower-Benachrichtigung trotz Schalter aus';
  END IF;
  RAISE NOTICE 'ok: Neuer Follower beachtet den Schalter';
END $$;

ROLLBACK;
