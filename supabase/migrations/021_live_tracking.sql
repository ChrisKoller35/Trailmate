-- ============================================================
-- Migration 021: Live-Tracking – Token vom Server, Empfängerseite
-- ============================================================
-- Before:
--   - Das share_token entstand im Client mit Math.random(). Es gibt einer
--     fremden Person den Standort frei, war aber vorhersehbar, und der Client
--     konnte ein beliebiges Token wählen oder es später ändern.
--   - Eine vergessene Sitzung blieb unbegrenzt aktiv; mehrere aktive
--     Sitzungen pro Person liessen useLiveTracking (maybeSingle) scheitern.
--   - get_live_tracking_by_token (007, Suchpfad 014) lieferte den
--     Anzeigenamen unter dem Schlüssel 'username', die App erwartet
--     'display_name'.
-- After:
--   - Ein Trigger setzt share_token beim Anlegen immer selbst (32 Zeichen aus
--     gen_random_uuid()). share_token und user_id lassen sich nicht ändern.
--   - Eine neue Sitzung beendet ältere aktive Sitzungen derselben Person.
--   - get_live_tracking_by_token liefert 'display_name' (sonst Username) und
--     nichts für beendete oder vor mehr als 48 Stunden gestartete Sitzungen.

-- ── Token vom Server, Besitz unveränderlich ─────────────────
CREATE OR REPLACE FUNCTION live_tracking_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.share_token := replace(gen_random_uuid()::text, '-', '');
    RETURN NEW;
  END IF;

  IF NEW.share_token IS DISTINCT FROM OLD.share_token
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Token und Besitzer einer Live-Sitzung sind unveränderlich'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_tracking_before_write ON live_tracking_sessions;
CREATE TRIGGER trg_live_tracking_before_write
  BEFORE INSERT OR UPDATE ON live_tracking_sessions
  FOR EACH ROW
  EXECUTE FUNCTION live_tracking_before_write();

-- ── Neue Sitzung beendet ältere ─────────────────────────────
CREATE OR REPLACE FUNCTION live_tracking_end_older()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE live_tracking_sessions
  SET is_active = FALSE
  WHERE user_id = NEW.user_id
    AND id <> NEW.id
    AND is_active;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_tracking_end_older ON live_tracking_sessions;
CREATE TRIGGER trg_live_tracking_end_older
  AFTER INSERT ON live_tracking_sessions
  FOR EACH ROW
  EXECUTE FUNCTION live_tracking_end_older();

-- ── Lesen per Token (Empfängerseite, auch ohne Konto) ───────
CREATE OR REPLACE FUNCTION get_live_tracking_by_token(p_token VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'display_name', COALESCE(NULLIF(btrim(u.display_name), ''), u.username),
    'avatar_url', u.avatar_url,
    'last_location', CASE WHEN lts.last_location IS NOT NULL
      THEN json_build_object(
        'longitude', ST_X(lts.last_location),
        'latitude', ST_Y(lts.last_location)
      ) ELSE NULL END,
    'last_updated_at', lts.last_updated_at,
    'expected_return', lts.expected_return,
    'is_active', lts.is_active,
    'started_at', lts.started_at
  ) INTO result
  FROM live_tracking_sessions lts
  JOIN users u ON u.id = lts.user_id
  WHERE lts.share_token = p_token
    AND lts.is_active = TRUE
    AND lts.started_at > NOW() - INTERVAL '48 hours';

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_live_tracking_by_token(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_live_tracking_by_token(VARCHAR) TO anon, authenticated;

-- ── Einmalig aufräumen ──────────────────────────────────────
-- Abgelaufene Sitzungen beenden, pro Person nur die neueste aktiv lassen.
UPDATE live_tracking_sessions
SET is_active = FALSE
WHERE is_active
  AND (
    started_at <= NOW() - INTERVAL '48 hours'
    OR id <> (
      SELECT l2.id FROM live_tracking_sessions l2
      WHERE l2.user_id = live_tracking_sessions.user_id AND l2.is_active
      ORDER BY l2.started_at DESC, l2.id
      LIMIT 1
    )
  );
