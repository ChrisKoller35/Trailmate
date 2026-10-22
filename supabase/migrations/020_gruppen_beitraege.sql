-- ============================================================
-- Migration 020: Beiträge in Gruppen und Communities
-- Ist-Soll 06 (Gruppen-/Community-Beiträge)
-- ============================================================
-- Before:
--   - posts_insert/posts_update prüfen nur user_id: jede Person postet in
--     jede Gruppe/Community oder verschiebt eigene Beiträge dorthin.
--   - posts_delete: nur der Autor; Admins/Moderatoren können nichts entfernen.
--   - groups_delete/communities_delete: nur der Ersteller, nicht weitere Admins.
--   - fk_posts_group/fk_posts_community ohne ON DELETE: Gruppe löschen
--     scheitert, solange Beiträge existieren (Client löschte von Hand).
--   - reports.post_id/comment_id/reported_user_id/resolved_by ohne ON DELETE:
--     ein gemeldeter Beitrag lässt sich nicht löschen (reports_post_id_fkey).
-- After:
--   - Beitrag mit group_id nur als Gruppenmitglied, mit community_id nur als
--     Community-Mitglied, nie beides zugleich.
--   - Autor oder Admin/Moderator der Gruppe bzw. Community löscht Beiträge.
--   - Ersteller oder Admin löscht Gruppe bzw. Community; Beiträge fallen mit.
--   - Meldungen bleiben beim Löschen erhalten, die Verweise werden NULL.
--
-- Down:
--   Policies posts_insert, posts_update, posts_delete, groups_delete,
--   communities_delete wie in 002_rls_policies.sql (Zeilen 163-175, 457-459,
--   622-624) und die Fremdschlüssel wie in 001_initial_schema.sql
--   (Zeilen 203, 260, 304-316) ohne ON DELETE wiederherstellen.

-- ── Beiträge ────────────────────────────────────────────────
-- Gemeinsame Bedingung für INSERT und UPDATE (WITH CHECK)
CREATE OR REPLACE FUNCTION can_write_post(p_group_id UUID, p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_group_id IS NOT NULL AND p_community_id IS NOT NULL THEN FALSE
    WHEN p_group_id IS NOT NULL THEN is_group_member(p_group_id, auth.uid())
    WHEN p_community_id IS NOT NULL THEN is_community_member(p_community_id, auth.uid())
    ELSE TRUE
  END;
$$;

DROP POLICY IF EXISTS posts_insert ON posts;
CREATE POLICY posts_insert ON posts FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND can_write_post(group_id, community_id)
);

DROP POLICY IF EXISTS posts_update ON posts;
CREATE POLICY posts_update ON posts FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
  AND can_write_post(group_id, community_id)
);

DROP POLICY IF EXISTS posts_delete ON posts;
CREATE POLICY posts_delete ON posts FOR DELETE USING (
  user_id = auth.uid()
  OR (group_id IS NOT NULL
    AND group_role(group_id, auth.uid()) IN ('admin', 'moderator'))
  OR (community_id IS NOT NULL
    AND community_role(community_id, auth.uid()) IN ('admin', 'moderator'))
);

-- ── Gruppen und Communities löschen ─────────────────────────
DROP POLICY IF EXISTS groups_delete ON groups;
CREATE POLICY groups_delete ON groups FOR DELETE USING (
  created_by = auth.uid()
  OR group_role(id, auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS communities_delete ON communities;
CREATE POLICY communities_delete ON communities FOR DELETE USING (
  created_by = auth.uid()
  OR community_role(id, auth.uid()) = 'admin'
);

-- ── Fremdschlüssel der Beiträge ─────────────────────────────
ALTER TABLE posts DROP CONSTRAINT IF EXISTS fk_posts_group;
ALTER TABLE posts ADD CONSTRAINT fk_posts_group
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS fk_posts_community;
ALTER TABLE posts ADD CONSTRAINT fk_posts_community
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

-- ── Fremdschlüssel der Meldungen ────────────────────────────
-- Die Meldung bleibt für die Moderation erhalten, auch wenn Beitrag,
-- Kommentar oder Konto verschwinden.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_post_id_fkey;
ALTER TABLE reports ADD CONSTRAINT reports_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL;

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_comment_id_fkey;
ALTER TABLE reports ADD CONSTRAINT reports_comment_id_fkey
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL;

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reported_user_id_fkey;
ALTER TABLE reports ADD CONSTRAINT reports_reported_user_id_fkey
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_resolved_by_fkey;
ALTER TABLE reports ADD CONSTRAINT reports_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;
