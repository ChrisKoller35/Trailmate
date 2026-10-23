-- Test für Migration 020. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: A = Ersteller und Admin, B = zweiter Admin, M = Moderator,
--         N = normales Mitglied, X = aussenstehend
-- Gruppen: G (A, B, M, N), H (nur X); Community C (A, N)

BEGIN;

INSERT INTO users (id, username) VALUES
  ('00000000-0000-0000-0000-0000000020a1', 'test_20_ersteller'),
  ('00000000-0000-0000-0000-0000000020b2', 'test_20_admin'),
  ('00000000-0000-0000-0000-0000000020c3', 'test_20_mod'),
  ('00000000-0000-0000-0000-0000000020d4', 'test_20_mitglied'),
  ('00000000-0000-0000-0000-0000000020e5', 'test_20_aussen');
INSERT INTO groups (id, name, created_by) VALUES
  ('00000000-0000-0000-0000-00000000a020', 'Testgruppe G', '00000000-0000-0000-0000-0000000020a1'),
  ('00000000-0000-0000-0000-00000000b020', 'Testgruppe H', '00000000-0000-0000-0000-0000000020e5');
INSERT INTO group_members (group_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000a020', '00000000-0000-0000-0000-0000000020a1', 'admin'),
  ('00000000-0000-0000-0000-00000000a020', '00000000-0000-0000-0000-0000000020b2', 'admin'),
  ('00000000-0000-0000-0000-00000000a020', '00000000-0000-0000-0000-0000000020c3', 'moderator'),
  ('00000000-0000-0000-0000-00000000a020', '00000000-0000-0000-0000-0000000020d4', 'member'),
  ('00000000-0000-0000-0000-00000000b020', '00000000-0000-0000-0000-0000000020e5', 'admin');
INSERT INTO communities (id, name, created_by) VALUES
  ('00000000-0000-0000-0000-00000000c020', 'Testcommunity C', '00000000-0000-0000-0000-0000000020a1');
INSERT INTO community_members (community_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000c020', '00000000-0000-0000-0000-0000000020a1', 'admin'),
  ('00000000-0000-0000-0000-00000000c020', '00000000-0000-0000-0000-0000000020d4', 'member');

-- ── X: nicht Mitglied, postet weder in G noch in C ──────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000020e5","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO posts (user_id, group_id, content) VALUES
      ('00000000-0000-0000-0000-0000000020e5', '00000000-0000-0000-0000-00000000a020', 'X in G');
    RAISE EXCEPTION 'FEHLER: Nicht-Mitglied hat in die Gruppe gepostet';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Nicht-Mitglied kann nicht in die Gruppe posten';
  END;

  BEGIN
    INSERT INTO posts (user_id, community_id, content) VALUES
      ('00000000-0000-0000-0000-0000000020e5', '00000000-0000-0000-0000-00000000c020', 'X in C');
    RAISE EXCEPTION 'FEHLER: Nicht-Mitglied hat in die Community gepostet';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Nicht-Mitglied kann nicht in die Community posten';
  END;
END $$;

-- ── N: postet als Mitglied, aber nicht in fremde Gruppe ─────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000020d4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  INSERT INTO posts (id, user_id, group_id, content) VALUES
    ('00000000-0000-0000-0000-00000000f201', '00000000-0000-0000-0000-0000000020d4',
     '00000000-0000-0000-0000-00000000a020', 'N in G');
  INSERT INTO posts (id, user_id, community_id, content) VALUES
    ('00000000-0000-0000-0000-00000000f202', '00000000-0000-0000-0000-0000000020d4',
     '00000000-0000-0000-0000-00000000c020', 'N in C');
  RAISE NOTICE 'ok: Mitglied postet in Gruppe und Community';

  BEGIN
    INSERT INTO posts (user_id, group_id, community_id, content) VALUES
      ('00000000-0000-0000-0000-0000000020d4', '00000000-0000-0000-0000-00000000a020',
       '00000000-0000-0000-0000-00000000c020', 'N in G und C');
    RAISE EXCEPTION 'FEHLER: Beitrag in Gruppe und Community zugleich';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: nie Gruppe und Community zugleich';
  END;

  BEGIN
    UPDATE posts SET group_id = '00000000-0000-0000-0000-00000000b020'
    WHERE id = '00000000-0000-0000-0000-00000000f201';
    RAISE EXCEPTION 'FEHLER: eigener Beitrag in fremde Gruppe verschoben';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: eigenen Beitrag nicht in fremde Gruppe verschieben';
  END;
END $$;

-- ── M: Moderator postet (wird später von N gemeldet) ────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000020c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO posts (id, user_id, group_id, content) VALUES
  ('00000000-0000-0000-0000-00000000f203', '00000000-0000-0000-0000-0000000020c3',
   '00000000-0000-0000-0000-00000000a020', 'M in G');

-- ── N: löscht keinen fremden Beitrag, meldet ihn aber ───────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000020d4","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  DELETE FROM posts WHERE id = '00000000-0000-0000-0000-00000000f203';
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = '00000000-0000-0000-0000-00000000f203') THEN
    RAISE EXCEPTION 'FEHLER: normales Mitglied hat fremden Gruppen-Beitrag gelöscht';
  END IF;
  RAISE NOTICE 'ok: normales Mitglied löscht keinen fremden Beitrag';

  INSERT INTO reports (id, reporter_id, post_id, reason) VALUES
    ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-0000000020d4',
     '00000000-0000-0000-0000-00000000f203', 'spam');
END $$;

-- ── M: löscht den eigenen, gemeldeten Beitrag und N's Beitrag ──
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000020c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  DELETE FROM posts WHERE id = '00000000-0000-0000-0000-00000000f203';
  IF EXISTS (SELECT 1 FROM posts WHERE id = '00000000-0000-0000-0000-00000000f203') THEN
    RAISE EXCEPTION 'FEHLER: gemeldeter Beitrag ließ sich vom Autor nicht löschen';
  END IF;
  RAISE NOTICE 'ok: Autor löscht gemeldeten Beitrag';

  DELETE FROM posts WHERE id = '00000000-0000-0000-0000-00000000f201';
  IF EXISTS (SELECT 1 FROM posts WHERE id = '00000000-0000-0000-0000-00000000f201') THEN
    RAISE EXCEPTION 'FEHLER: Moderator konnte fremden Gruppen-Beitrag nicht löschen';
  END IF;
  RAISE NOTICE 'ok: Moderator löscht fremden Gruppen-Beitrag';
END $$;

-- Meldung bleibt für die Moderation, nur der Verweis ist weg
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM reports
    WHERE id = '00000000-0000-0000-0000-00000000e201' AND post_id IS NULL
  ) THEN
    RAISE EXCEPTION 'FEHLER: Meldung fehlt oder post_id ist nicht NULL';
  END IF;
  RAISE NOTICE 'ok: Meldung bleibt mit post_id NULL';
END $$;

-- ── A: Beitrag für die Lösch-Kaskade ────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO posts (id, user_id, group_id, content) VALUES
  ('00000000-0000-0000-0000-00000000f204', '00000000-0000-0000-0000-0000000020a1',
   '00000000-0000-0000-0000-00000000a020', 'A in G');

-- ── M: Moderator löscht die Gruppe nicht ────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000020c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  DELETE FROM groups WHERE id = '00000000-0000-0000-0000-00000000a020';
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = '00000000-0000-0000-0000-00000000a020') THEN
    RAISE EXCEPTION 'FEHLER: Moderator hat die Gruppe gelöscht';
  END IF;
  RAISE NOTICE 'ok: Moderator löscht die Gruppe nicht';
END $$;

-- ── B: Admin (nicht Ersteller) löscht die Gruppe ────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000020b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DELETE FROM groups WHERE id = '00000000-0000-0000-0000-00000000a020';

RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM groups WHERE id = '00000000-0000-0000-0000-00000000a020') THEN
    RAISE EXCEPTION 'FEHLER: Admin konnte die Gruppe nicht löschen';
  END IF;
  IF EXISTS (SELECT 1 FROM posts WHERE group_id = '00000000-0000-0000-0000-00000000a020') THEN
    RAISE EXCEPTION 'FEHLER: Gruppen-Beiträge blieben nach dem Löschen stehen';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = '00000000-0000-0000-0000-00000000f202') THEN
    RAISE EXCEPTION 'FEHLER: Community-Beitrag ist mit der Gruppe verschwunden';
  END IF;
  RAISE NOTICE 'ok: Admin löscht die Gruppe, ihre Beiträge verschwinden mit';
END $$;

ROLLBACK;
