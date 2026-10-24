-- ============================================================
-- Migration 023: Prüfen, ob ein Benutzername frei ist
-- Ist-Soll 02, Aufgabe 3
-- ============================================================
-- Before: Die App prüft per SELECT auf users. Die Policy users_select
-- versteckt private Profile vor Nicht-Followern, deshalb gilt ein
-- vergebener Name fälschlich als frei; beim Speichern folgt 23505.
-- After: is_username_available sieht alle Konten, vergleicht ohne
-- Gross-/Kleinschreibung und nimmt das eigene Konto aus.
-- Keine Änderung an Tabellen: alte Namen dürfen länger sein oder
-- Grossbuchstaben haben.

CREATE OR REPLACE FUNCTION is_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_username IS NULL OR p_username !~ '^[a-z0-9_]{3,30}$' THEN
    RETURN FALSE;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM users
    WHERE lower(username) = lower(p_username)
      AND id IS DISTINCT FROM auth.uid()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION is_username_available(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_username_available(TEXT) TO authenticated;
