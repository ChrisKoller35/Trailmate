-- ============================================================
-- Migration 009: Statusfelder nur serverseitig
-- Ist-Soll 02 und 08, ROADMAP M1 ("Grün und sicher")
-- ============================================================
-- Before: users_update erlaubt jedem Konto, die eigene Zeile beliebig zu
-- ändern, also auch is_premium und is_verified (app/premium.tsx tat genau
-- das). users_insert erlaubt, die eigene Zeile gleich mit diesen Werten
-- anzulegen.
-- After: Für die Client-Rollen anon und authenticated
--   - setzt ein INSERT is_premium und is_verified immer auf FALSE,
--   - schlägt ein UPDATE fehl, das einen der beiden Werte ändert.
-- Service-Rolle, postgres und SECURITY-DEFINER-Funktionen (laufen als
-- Besitzer) dürfen die Felder weiterhin setzen, z. B. nach einem Kauf.

CREATE OR REPLACE FUNCTION protect_user_status_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_premium := FALSE;
    NEW.is_verified := FALSE;
    RETURN NEW;
  END IF;

  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'is_premium und is_verified werden nur serverseitig gesetzt'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_protect_status_fields ON users;
CREATE TRIGGER users_protect_status_fields
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION protect_user_status_fields();

-- Down:
-- DROP TRIGGER IF EXISTS users_protect_status_fields ON users;
-- DROP FUNCTION IF EXISTS protect_user_status_fields();
