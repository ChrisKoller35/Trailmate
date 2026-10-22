-- Test für Migration 017. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: A = Admin, U = Mitglied auf Probe

BEGIN;

INSERT INTO users (id, username, is_verified) VALUES
  ('00000000-0000-0000-0000-0000000017a1', 'test_17_admin', TRUE),
  ('00000000-0000-0000-0000-0000000017b2', 'test_17_user', FALSE);
INSERT INTO communities (id, name, created_by) VALUES
  ('00000000-0000-0000-0000-00000000c017', 'Testcommunity 17', '00000000-0000-0000-0000-0000000017a1');
INSERT INTO community_members (community_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000c017', '00000000-0000-0000-0000-0000000017a1', 'admin');
INSERT INTO groups (id, name, is_private, created_by) VALUES
  ('00000000-0000-0000-0000-00000000a017', 'Offen 17', FALSE, '00000000-0000-0000-0000-0000000017a1'),
  ('00000000-0000-0000-0000-00000000b017', 'Privat 17', TRUE, '00000000-0000-0000-0000-0000000017a1');
INSERT INTO group_members (group_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000a017', '00000000-0000-0000-0000-0000000017a1', 'admin'),
  ('00000000-0000-0000-0000-00000000b017', '00000000-0000-0000-0000-0000000017a1', 'admin');

-- ── U stellt eine Anfrage ───────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000017b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO community_join_requests (community_id, user_id) VALUES
  ('00000000-0000-0000-0000-00000000c017', '00000000-0000-0000-0000-0000000017b2');

-- ── A nimmt an (wie der Hook seit PR #25) und entfernt U wieder ──
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000017a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO community_members (community_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000c017', '00000000-0000-0000-0000-0000000017b2', 'member');
UPDATE community_join_requests SET status = 'accepted'
WHERE community_id = '00000000-0000-0000-0000-00000000c017'
  AND user_id = '00000000-0000-0000-0000-0000000017b2';
DELETE FROM community_members
WHERE community_id = '00000000-0000-0000-0000-00000000c017'
  AND user_id = '00000000-0000-0000-0000-0000000017b2';

RESET ROLE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM community_join_requests
    WHERE community_id = '00000000-0000-0000-0000-00000000c017'
      AND user_id = '00000000-0000-0000-0000-0000000017b2'
  ) THEN
    RAISE EXCEPTION 'FEHLER: angenommene Anfrage blieb nach dem Entfernen stehen';
  END IF;
  RAISE NOTICE 'ok: Anfrage beim Entfernen gelöscht';
END $$;

-- ── U: selbst wieder eintreten scheitert, neue Anfrage geht ──
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000017b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO community_members (community_id, user_id, role) VALUES
      ('00000000-0000-0000-0000-00000000c017', '00000000-0000-0000-0000-0000000017b2', 'member');
    RAISE EXCEPTION 'FEHLER: entferntes Mitglied ist selbst wieder eingetreten';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Selbst-Eintritt in die Community abgelehnt';
  END;

  INSERT INTO community_join_requests (community_id, user_id) VALUES
    ('00000000-0000-0000-0000-00000000c017', '00000000-0000-0000-0000-0000000017b2');
  RAISE NOTICE 'ok: neue Anfrage nach dem Entfernen möglich';

  -- Gruppen: öffentliche selbst beitreten ja, private nein
  INSERT INTO group_members (group_id, user_id, role) VALUES
    ('00000000-0000-0000-0000-00000000a017', '00000000-0000-0000-0000-0000000017b2', 'member');
  RAISE NOTICE 'ok: Self-Join in öffentliche Gruppe';

  BEGIN
    INSERT INTO group_members (group_id, user_id, role) VALUES
      ('00000000-0000-0000-0000-00000000b017', '00000000-0000-0000-0000-0000000017b2', 'member');
    RAISE EXCEPTION 'FEHLER: Self-Join in private Gruppe gelungen';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Self-Join in private Gruppe abgelehnt';
  END;
END $$;

-- ── U verlässt die öffentliche Gruppe selbst: auch das räumt auf ──
RESET ROLE;
INSERT INTO group_join_requests (group_id, user_id, status) VALUES
  ('00000000-0000-0000-0000-00000000a017', '00000000-0000-0000-0000-0000000017b2', 'accepted');
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000017b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DELETE FROM group_members
WHERE group_id = '00000000-0000-0000-0000-00000000a017'
  AND user_id = '00000000-0000-0000-0000-0000000017b2';

RESET ROLE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM group_join_requests
    WHERE group_id = '00000000-0000-0000-0000-00000000a017'
      AND user_id = '00000000-0000-0000-0000-0000000017b2'
  ) THEN
    RAISE EXCEPTION 'FEHLER: angenommene Gruppen-Anfrage blieb nach dem Verlassen stehen';
  END IF;
  RAISE NOTICE 'ok: Anfrage beim Verlassen gelöscht';
END $$;

ROLLBACK;
