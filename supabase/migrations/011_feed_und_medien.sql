-- ============================================================
-- Migration 011: Entdecken-Feed und Medien-Speicher reparieren
-- Gefunden beim ersten Test gegen echtes Supabase (17.10.2026)
-- ============================================================

-- ─── 1. get_explore_feed ───────────────────────────────────
-- Before: Jeder Aufruf endete mit HTTP 400. username und display_name sind in
-- users VARCHAR, die Funktion versprach TEXT ("structure of query does not
-- match function result type"); dazu war ORDER BY score mehrdeutig, weil
-- score auch Ausgabespalte ist.
-- After: Spalten nach TEXT gecastet, Spaltennamen haben Vorrang
-- (#variable_conflict use_column), search_path fest gesetzt.

CREATE OR REPLACE FUNCTION get_explore_feed(
  p_user_id UUID,
  p_user_region TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  media_urls JSONB,
  route_id UUID,
  location GEOMETRY,
  group_id UUID,
  community_id UUID,
  created_at TIMESTAMPTZ,
  likes_count INTEGER,
  comments_count INTEGER,
  saves_count INTEGER,
  is_hidden BOOLEAN,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  score DOUBLE PRECISION
) AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.user_id, p.content, p.media_urls, p.route_id,
    p.location, p.group_id, p.community_id, p.created_at,
    p.likes_count, p.comments_count, p.saves_count, p.is_hidden,
    u.username::TEXT, u.display_name::TEXT, u.avatar_url,
    (
      (p.likes_count * 2 + p.comments_count * 3 + p.saves_count * 4)::DOUBLE PRECISION
      * (1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 * 0.05))
      * CASE WHEN p_user_region IS NOT NULL AND u.home_region = p_user_region THEN 1.5 ELSE 1.0 END
    ) AS score
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.group_id IS NULL
    AND p.community_id IS NULL
    AND u.is_private = false
    AND COALESCE(p.is_hidden, false) = false
    AND p.user_id != p_user_id
    AND p.user_id NOT IN (
      SELECT blocked_id FROM blocks WHERE blocker_id = p_user_id
      UNION
      SELECT blocker_id FROM blocks WHERE blocked_id = p_user_id
    )
  ORDER BY score DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ─── 2. Speicher-Bucket "media" ────────────────────────────
-- Before: Bucket und Policies waren nie in einer Migration, sondern nur von
-- Hand im Dashboard angelegt; nach dem Zurücksetzen scheiterte jeder Upload
-- mit "new row violates row-level security policy".
-- After: Bucket öffentlich lesbar. Hochladen nur angemeldet; Avatare und
-- Titelbilder nur in den eigenen Ordner (avatars/<uid>/, covers/<uid>/).
-- Post-, GPX- und Wegzustands-Bilder werden vor der Datenbank-Zeile
-- hochgeladen, ihr Ordner lässt sich darum noch nicht an den Besitzer
-- binden. Ändern und Löschen nur durch die Person, die hochgeladen hat.

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS media_select ON storage.objects;
CREATE POLICY media_select ON storage.objects FOR SELECT USING (
  bucket_id = 'media'
);

DROP POLICY IF EXISTS media_insert ON storage.objects;
CREATE POLICY media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'media'
  AND (
    (
      (storage.foldername(name))[1] IN ('avatars', 'covers')
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR (storage.foldername(name))[1] IN ('posts', 'gpx', 'trail-conditions')
  )
);

DROP POLICY IF EXISTS media_update ON storage.objects;
CREATE POLICY media_update ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'media' AND owner = auth.uid()
) WITH CHECK (
  bucket_id = 'media' AND owner = auth.uid()
);

DROP POLICY IF EXISTS media_delete ON storage.objects;
CREATE POLICY media_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'media' AND owner = auth.uid()
);
