-- Test für Migration 012. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: A = Admin (verifiziert), M = Moderator, B = Mitglied,
--         C = Aussenstehend (nicht verifiziert)

BEGIN;

INSERT INTO users (id, username, is_verified) VALUES
  ('00000000-0000-0000-0000-0000000012a1', 'test_gr_admin', TRUE),
  ('00000000-0000-0000-0000-0000000012b2', 'test_gr_mod', FALSE),
  ('00000000-0000-0000-0000-0000000012c3', 'test_gr_member', FALSE),
  ('00000000-0000-0000-0000-0000000012d4', 'test_gr_outsider', FALSE);
INSERT INTO communities (id, name, created_by) VALUES
  ('00000000-0000-0000-0000-00000000c012', 'Testcommunity', '00000000-0000-0000-0000-0000000012a1');
INSERT INTO community_members (community_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000c012', '00000000-0000-0000-0000-0000000012a1', 'admin'),
  ('00000000-0000-0000-0000-00000000c012', '00000000-0000-0000-0000-0000000012b2', 'moderator'),
  ('00000000-0000-0000-0000-00000000c012', '00000000-0000-0000-0000-0000000012c3', 'member');

-- ── C: Direkt-Eintrag scheitert, Anfrage geht ───────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000012d4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO community_members (community_id, user_id, role) VALUES
      ('00000000-0000-0000-0000-00000000c012', '00000000-0000-0000-0000-0000000012d4', 'member');
    RAISE EXCEPTION 'FEHLER: Direkt-Eintrag in die Community gelungen';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Direkt-Eintrag abgelehnt';
  END;

  BEGIN
    INSERT INTO community_join_requests (community_id, user_id, status) VALUES
      ('00000000-0000-0000-0000-00000000c012', '00000000-0000-0000-0000-0000000012d4', 'accepted');
    RAISE EXCEPTION 'FEHLER: selbst angenommene Beitrittsanfrage angelegt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Anfrage kann nicht selbst angenommen angelegt werden';
  END;

  BEGIN
    INSERT INTO communities (name, created_by) VALUES
      ('Unverifiziert', '00000000-0000-0000-0000-0000000012d4');
    RAISE EXCEPTION 'FEHLER: nicht verifiziertes Konto hat Community angelegt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Community nur für verifizierte Konten';
  END;

  INSERT INTO community_join_requests (community_id, user_id, status) VALUES
    ('00000000-0000-0000-0000-00000000c012', '00000000-0000-0000-0000-0000000012d4', 'pending');
END $$;

-- ── A: Anfrage genehmigen, verifiziert Community anlegen ────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000012a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  UPDATE community_join_requests SET status = 'accepted'
  WHERE community_id = '00000000-0000-0000-0000-00000000c012'
    AND user_id = '00000000-0000-0000-0000-0000000012d4';
  INSERT INTO community_members (community_id, user_id, role) VALUES
    ('00000000-0000-0000-0000-00000000c012', '00000000-0000-0000-0000-0000000012d4', 'member');
  RAISE NOTICE 'ok: Admin-Genehmigung gelingt';

  INSERT INTO communities (id, name, created_by) VALUES
    ('00000000-0000-0000-0000-00000000c013', 'Verifiziert', '00000000-0000-0000-0000-0000000012a1');
  INSERT INTO community_members (community_id, user_id, role) VALUES
    ('00000000-0000-0000-0000-00000000c013', '00000000-0000-0000-0000-0000000012a1', 'admin');
  RAISE NOTICE 'ok: verifiziertes Konto legt Community an und wird Admin';
END $$;

-- ── M: Mitglied entfernen ja, Admin entfernen nein ──────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000012b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM community_members
  WHERE community_id = '00000000-0000-0000-0000-00000000c012'
    AND user_id = '00000000-0000-0000-0000-0000000012c3';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'FEHLER: Moderator kann Mitglied nicht entfernen';
  END IF;

  DELETE FROM community_members
  WHERE community_id = '00000000-0000-0000-0000-00000000c012'
    AND user_id = '00000000-0000-0000-0000-0000000012a1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN
    RAISE EXCEPTION 'FEHLER: Moderator hat Admin entfernt';
  END IF;
  RAISE NOTICE 'ok: Moderator entfernt Mitglied, aber keinen Admin';
END $$;

-- ── C (jetzt Mitglied): Community-Event und Zusage ──────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000012d4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  INSERT INTO group_events (id, group_id, community_id, title, event_date, created_by) VALUES
    ('00000000-0000-0000-0000-00000000e012', NULL, '00000000-0000-0000-0000-00000000c012',
     'Testwanderung', NOW() + INTERVAL '7 days', '00000000-0000-0000-0000-0000000012d4');
  INSERT INTO event_responses (event_id, user_id, response) VALUES
    ('00000000-0000-0000-0000-00000000e012', '00000000-0000-0000-0000-0000000012d4', 'going');
  IF NOT EXISTS (
    SELECT 1 FROM event_responses WHERE event_id = '00000000-0000-0000-0000-00000000e012'
  ) THEN
    RAISE EXCEPTION 'FEHLER: eigene Zusage zum Community-Event nicht lesbar';
  END IF;
  RAISE NOTICE 'ok: Community-Event und Zusage gelingen';
END $$;

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = '00000000-0000-0000-0000-00000000c012'
      AND user_id = '00000000-0000-0000-0000-0000000012a1'
  ) THEN
    RAISE EXCEPTION 'FEHLER: Admin ist nicht mehr Mitglied';
  END IF;
  RAISE NOTICE 'ok: Admin weiterhin Mitglied';
END $$;

ROLLBACK;
