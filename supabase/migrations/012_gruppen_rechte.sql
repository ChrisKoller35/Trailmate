-- ============================================================
-- Migration 012: Beitritt und Moderatorenrechte in Gruppen/Communities
-- Ist-Soll 06, Sicherheitsauffälligkeiten 1, 4, 6 und 7
-- ============================================================
-- Before:
--   - community_members_insert prüft nur user_id = auth.uid(): jeder tritt
--     direkt jeder Community bei (auch gleich als Admin), die
--     Admin-Genehmigung (fremde user_id) scheitert dagegen.
--   - Moderatoren dürfen Mitglieder hinzufügen, aber nicht entfernen.
--   - Community-Events (group_id NULL) scheitern an is_group_member.
--   - communities_insert prüft is_verified nicht.
-- After:
--   - Mitglied wird man als Ersteller (beliebige Rolle), durch Admin/Mod
--     (Rolle 'member') oder selbst als 'member' mit angenommener
--     Beitrittsanfrage; in öffentliche Gruppen weiterhin per Self-Join.
--   - Admins und Moderatoren entfernen Mitglieder, Moderatoren aber keine
--     Admins. Jeder darf sich selbst entfernen.
--   - Community-Mitglieder legen Community-Events an und sagen zu.
--   - Nur verifizierte Konten legen Communities an.

-- Helfer: Rolle des Aufrufers (SECURITY DEFINER, damit die Policies auf
-- group_members/community_members nicht rekursiv über RLS laufen)
CREATE OR REPLACE FUNCTION group_role(p_group_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM group_members
  WHERE group_id = p_group_id AND user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION community_role(p_community_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;
$$;

-- ── Gruppen-Mitglieder ──────────────────────────────────────
DROP POLICY IF EXISTS group_members_insert ON group_members;
CREATE POLICY group_members_insert ON group_members FOR INSERT WITH CHECK (
  -- Ersteller trägt sich beim Anlegen als Admin ein
  (user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.created_by = auth.uid()))
  -- Admin/Mod fügt ein Mitglied hinzu
  OR (role = 'member'
    AND group_role(group_id, auth.uid()) IN ('admin', 'moderator'))
  -- Self-Join: öffentliche Gruppe oder angenommene Anfrage
  OR (user_id = auth.uid() AND role = 'member' AND (
    NOT (SELECT g.is_private FROM groups g WHERE g.id = group_id)
    OR EXISTS (
      SELECT 1 FROM group_join_requests r
      WHERE r.group_id = group_members.group_id
        AND r.user_id = auth.uid()
        AND r.status = 'accepted'
    )
  ))
);

DROP POLICY IF EXISTS group_members_delete ON group_members;
CREATE POLICY group_members_delete ON group_members FOR DELETE USING (
  user_id = auth.uid()
  OR group_role(group_id, auth.uid()) = 'admin'
  OR (group_role(group_id, auth.uid()) = 'moderator' AND role IS DISTINCT FROM 'admin')
);

-- ── Community-Mitglieder ────────────────────────────────────
DROP POLICY IF EXISTS community_members_insert ON community_members;
CREATE POLICY community_members_insert ON community_members FOR INSERT WITH CHECK (
  (user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.created_by = auth.uid()))
  OR (role = 'member'
    AND community_role(community_id, auth.uid()) IN ('admin', 'moderator'))
  OR (user_id = auth.uid() AND role = 'member' AND EXISTS (
    SELECT 1 FROM community_join_requests r
    WHERE r.community_id = community_members.community_id
      AND r.user_id = auth.uid()
      AND r.status = 'accepted'
  ))
);

DROP POLICY IF EXISTS community_members_delete ON community_members;
CREATE POLICY community_members_delete ON community_members FOR DELETE USING (
  user_id = auth.uid()
  OR community_role(community_id, auth.uid()) = 'admin'
  OR (community_role(community_id, auth.uid()) = 'moderator' AND role IS DISTINCT FROM 'admin')
);

-- ── Events ──────────────────────────────────────────────────
DROP POLICY IF EXISTS group_events_insert ON group_events;
CREATE POLICY group_events_insert ON group_events FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND (
    (group_id IS NOT NULL AND is_group_member(group_id, auth.uid())
      AND (community_id IS NULL OR is_community_member(community_id, auth.uid())))
    OR (group_id IS NULL AND community_id IS NOT NULL
      AND is_community_member(community_id, auth.uid()))
  )
);

DROP POLICY IF EXISTS event_responses_select ON event_responses;
CREATE POLICY event_responses_select ON event_responses FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM group_events ge
    WHERE ge.id = event_responses.event_id
      AND (is_group_member(ge.group_id, auth.uid())
        OR (ge.community_id IS NOT NULL AND is_community_member(ge.community_id, auth.uid())))
  )
);

DROP POLICY IF EXISTS event_responses_insert ON event_responses;
CREATE POLICY event_responses_insert ON event_responses FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM group_events ge
    WHERE ge.id = event_id
      AND (is_group_member(ge.group_id, auth.uid())
        OR (ge.community_id IS NOT NULL AND is_community_member(ge.community_id, auth.uid())))
  )
);

-- ── Communities ─────────────────────────────────────────────
DROP POLICY IF EXISTS communities_insert ON communities;
CREATE POLICY communities_insert ON communities FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND COALESCE((SELECT is_verified FROM users WHERE id = auth.uid()), FALSE)
);

-- ── Beitrittsanfragen ───────────────────────────────────────
-- Neue Anfragen sind immer offen; sonst könnte man sich eine bereits
-- angenommene Anfrage selbst anlegen und damit den Self-Join oben öffnen.
DROP POLICY IF EXISTS group_join_requests_insert ON group_join_requests;
CREATE POLICY group_join_requests_insert ON group_join_requests FOR INSERT WITH CHECK (
  user_id = auth.uid() AND status = 'pending'
);

DROP POLICY IF EXISTS community_join_requests_insert ON community_join_requests;
CREATE POLICY community_join_requests_insert ON community_join_requests FOR INSERT WITH CHECK (
  user_id = auth.uid() AND status = 'pending'
);

-- Down: Policies aus 002_rls_policies.sql (Zeilen 471-499, 544-589,
-- 516-518, 610-612, 636-658, 674-676) wiederherstellen und
-- DROP FUNCTION IF EXISTS group_role(UUID, UUID);
-- DROP FUNCTION IF EXISTS community_role(UUID, UUID);
