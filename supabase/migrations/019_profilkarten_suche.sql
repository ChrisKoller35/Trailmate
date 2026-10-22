-- ============================================================
-- Migration 019: Profilkarten und Personensuche
-- ============================================================
-- Before:
--   - users_select (002) blendet private Profile für alle aus, die ihnen nicht
--     folgen. Die App zeigte darum bei einem privaten Profil «Profil nicht
--     verfügbar» statt «Dieses Profil ist privat» mit Folgen-Knopf, und
--     private Anfragende erschienen in Folge- und Beitrittsanfragen als
--     «Unbekannt».
--   - Es gab keine Nutzersuche.
-- After:
--   - get_profile_cards liefert für bis zu 100 IDs eine Profilkarte (nur
--     id, username, display_name, avatar_url, is_private, is_verified), auch
--     für private Profile. Keine Bio, keine Region, keine Zahlen.
--   - search_profiles sucht in username und display_name und liefert
--     dieselben Karten.
--   - Personen mit Blockierung in einer der beiden Richtungen fehlen immer.
--     Ohne Login liefern beide Funktionen nichts.

-- ── Profilkarten ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_profile_cards(p_ids UUID[])
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  display_name VARCHAR,
  avatar_url TEXT,
  is_private BOOLEAN,
  is_verified BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.username, u.display_name, u.avatar_url,
         COALESCE(u.is_private, FALSE), COALESCE(u.is_verified, FALSE)
  FROM users u
  WHERE auth.uid() IS NOT NULL
    AND u.id = ANY (p_ids[1:100])
    AND NOT is_blocked(auth.uid(), u.id);
$$;

REVOKE EXECUTE ON FUNCTION get_profile_cards(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_profile_cards(UUID[]) TO authenticated;

-- ── Personensuche ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_profiles(p_query TEXT, p_limit INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  display_name VARCHAR,
  avatar_url TEXT,
  is_private BOOLEAN,
  is_verified BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      lower(btrim(COALESCE(p_query, ''))) AS term,
      -- \ zuerst, damit die Escapes für % und _ nicht verdoppelt werden
      replace(replace(replace(lower(btrim(COALESCE(p_query, ''))),
        '\', '\\'), '%', '\%'), '_', '\_') AS pattern
  )
  SELECT u.id, u.username, u.display_name, u.avatar_url,
         COALESCE(u.is_private, FALSE), COALESCE(u.is_verified, FALSE)
  FROM users u, q
  WHERE auth.uid() IS NOT NULL
    AND char_length(q.term) >= 2
    AND u.id <> auth.uid()
    AND (
      u.username ILIKE '%' || q.pattern || '%' ESCAPE '\'
      OR u.display_name ILIKE '%' || q.pattern || '%' ESCAPE '\'
    )
    AND NOT is_blocked(auth.uid(), u.id)
  ORDER BY
    CASE
      WHEN lower(u.username) = q.term THEN 0
      WHEN u.username ILIKE q.pattern || '%' ESCAPE '\' THEN 1
      ELSE 2
    END,
    lower(u.username)
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 0), 50);
$$;

REVOKE EXECUTE ON FUNCTION search_profiles(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION search_profiles(TEXT, INT) TO authenticated;
