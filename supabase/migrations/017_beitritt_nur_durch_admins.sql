-- ============================================================
-- Migration 017: Beitritt nur noch durch Admins/Mods
-- Ergänzt 012 (Ist-Soll 06, Sicherheitsauffälligkeit 1)
-- ============================================================
-- Before:
--   - 012 erlaubte zusätzlich den Self-Join mit angenommener Anfrage. Die
--     Anfrage-Zeile bleibt nach dem Entfernen stehen, darum konnte sich ein
--     entferntes Mitglied selbst wieder eintragen.
--   - Nach dem Verlassen oder Entfernen scheiterte eine neue Anfrage am
--     Primärschlüssel (group_id/community_id, user_id), weil die alte Zeile
--     mit Status 'accepted' noch existierte.
-- After:
--   - Seit PR #25 trägt der Admin/Mod beim Annehmen das Mitglied selbst ein.
--     Mitglied wird man darum nur noch als Ersteller, durch Admin/Mod
--     (Rolle 'member') oder per Self-Join in eine öffentliche Gruppe.
--   - Verlässt jemand eine Gruppe/Community oder wird entfernt, wird seine
--     angenommene Anfrage gelöscht; eine neue Anfrage ist danach möglich.

-- ── Gruppen-Mitglieder ──────────────────────────────────────
DROP POLICY IF EXISTS group_members_insert ON group_members;
CREATE POLICY group_members_insert ON group_members FOR INSERT WITH CHECK (
  -- Ersteller trägt sich beim Anlegen als Admin ein
  (user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.created_by = auth.uid()))
  -- Admin/Mod fügt ein Mitglied hinzu (auch beim Annehmen einer Anfrage)
  OR (role = 'member'
    AND group_role(group_id, auth.uid()) IN ('admin', 'moderator'))
  -- Self-Join nur in öffentliche Gruppen
  OR (user_id = auth.uid() AND role = 'member'
    AND NOT (SELECT g.is_private FROM groups g WHERE g.id = group_id))
);

-- ── Community-Mitglieder ────────────────────────────────────
DROP POLICY IF EXISTS community_members_insert ON community_members;
CREATE POLICY community_members_insert ON community_members FOR INSERT WITH CHECK (
  (user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.created_by = auth.uid()))
  OR (role = 'member'
    AND community_role(community_id, auth.uid()) IN ('admin', 'moderator'))
);

-- ── Angenommene Anfrage beim Austritt entfernen ─────────────
-- SECURITY DEFINER: Wer ein Mitglied entfernt (Admin/Mod), darf die
-- Anfrage-Zeile einer anderen Person per RLS nicht löschen.
CREATE OR REPLACE FUNCTION clear_group_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM group_join_requests
  WHERE group_id = OLD.group_id AND user_id = OLD.user_id AND status = 'accepted';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_group_join_request ON group_members;
CREATE TRIGGER trg_clear_group_join_request
  AFTER DELETE ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION clear_group_join_request();

CREATE OR REPLACE FUNCTION clear_community_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM community_join_requests
  WHERE community_id = OLD.community_id AND user_id = OLD.user_id AND status = 'accepted';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_community_join_request ON community_members;
CREATE TRIGGER trg_clear_community_join_request
  AFTER DELETE ON community_members
  FOR EACH ROW
  EXECUTE FUNCTION clear_community_join_request();

-- Alte angenommene Anfragen von Personen, die nicht mehr Mitglied sind
DELETE FROM group_join_requests r
WHERE r.status = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM group_members m WHERE m.group_id = r.group_id AND m.user_id = r.user_id
  );
DELETE FROM community_join_requests r
WHERE r.status = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM community_members m
    WHERE m.community_id = r.community_id AND m.user_id = r.user_id
  );

-- Down: Policies group_members_insert und community_members_insert aus 012
-- wiederherstellen und
-- DROP TRIGGER IF EXISTS trg_clear_group_join_request ON group_members;
-- DROP TRIGGER IF EXISTS trg_clear_community_join_request ON community_members;
-- DROP FUNCTION IF EXISTS clear_group_join_request();
-- DROP FUNCTION IF EXISTS clear_community_join_request();
