-- ============================================================
-- Migration 018: Privaten Profilen nur per angenommener Anfrage folgen
-- ============================================================
-- Before:
--   - follows_insert (002) prüft nur follower_id und Blockierung. Wer einem
--     privaten Profil folgen wollte, schrieb direkt in follows und sah danach
--     Profil, Beiträge und Touren, ohne dass die Person zugestimmt hatte.
--     Die App tat das selbst: useFollow las is_private aus users, wo private
--     Profile für Nicht-Follower unsichtbar sind, und folgte dann direkt.
--   - Jede Annahme einer Folge-Anfrage scheiterte: Die Zielperson schrieb
--     follows (follower = anfragende Person), was follows_insert
--     (follower_id = auth.uid()) verbietet. Der Fehler landete nur in der
--     Konsole, die Anfrage stand trotzdem auf 'accepted'.
--   - Eine Anfrage liess sich direkt als 'accepted' anlegen, und abgelehnte
--     oder nach dem Entfolgen liegengebliebene Anfragen blockierten wegen des
--     Primärschlüssels (requester_id, target_id) jede neue Anfrage.
-- After:
--   - Direkt folgen geht nur bei öffentlichen Profilen, nie sich selbst.
--   - Bei privaten Profilen legt ein Trigger die Folge an, sobald die
--     Zielperson die Anfrage annimmt. Anfragen entstehen nur als 'pending',
--     das Paar lässt sich beim Ändern nicht umschreiben.
--   - Endet eine Folge (Entfolgen oder Entfernen), wird die Anfrage des Paars
--     gelöscht; eine neue Anfrage ist danach möglich.

-- ── Hilfsfunktion: privat ja/nein, auch für Nicht-Follower ──
CREATE OR REPLACE FUNCTION is_private_user(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT u.is_private FROM users u WHERE u.id = p_user), FALSE);
$$;

REVOKE EXECUTE ON FUNCTION is_private_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_private_user(UUID) TO authenticated;

-- ── Folgen ──────────────────────────────────────────────────
DROP POLICY IF EXISTS follows_insert ON follows;
CREATE POLICY follows_insert ON follows FOR INSERT WITH CHECK (
  follower_id = auth.uid()
  AND following_id <> auth.uid()
  AND NOT is_blocked(auth.uid(), following_id)
  AND NOT is_private_user(following_id)
);

-- ── Folge-Anfragen ──────────────────────────────────────────
DROP POLICY IF EXISTS follow_requests_insert ON follow_requests;
CREATE POLICY follow_requests_insert ON follow_requests FOR INSERT WITH CHECK (
  requester_id = auth.uid()
  AND target_id <> auth.uid()
  AND status = 'pending'
  AND NOT is_blocked(auth.uid(), target_id)
);

-- Annahme legt die Folge an. Die Zielperson darf nur den Status ändern.
CREATE OR REPLACE FUNCTION accept_follow_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.target_id IS DISTINCT FROM OLD.target_id THEN
    RAISE EXCEPTION 'Eine Folge-Anfrage kann nicht umgeschrieben werden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted'
     AND NOT is_blocked(NEW.requester_id, NEW.target_id) THEN
    INSERT INTO follows (follower_id, following_id)
    VALUES (NEW.requester_id, NEW.target_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accept_follow_request ON follow_requests;
CREATE TRIGGER trg_accept_follow_request
  AFTER UPDATE ON follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION accept_follow_request();

-- Endet eine Folge, verschwindet die Anfrage des Paars.
CREATE OR REPLACE FUNCTION clear_follow_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM follow_requests
  WHERE requester_id = OLD.follower_id AND target_id = OLD.following_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_follow_request ON follows;
CREATE TRIGGER trg_clear_follow_request
  AFTER DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION clear_follow_request();

-- ── Einmalig aufräumen ──────────────────────────────────────
-- Angenommene Anfragen, deren Folge am alten Fehler scheiterte, nachholen.
INSERT INTO follows (follower_id, following_id)
SELECT fr.requester_id, fr.target_id
FROM follow_requests fr
WHERE fr.status = 'accepted'
  AND fr.requester_id <> fr.target_id
  AND NOT is_blocked(fr.requester_id, fr.target_id)
ON CONFLICT DO NOTHING;

-- Abgelehnte Anfragen löschen, damit eine neue Anfrage möglich ist.
DELETE FROM follow_requests WHERE status = 'rejected';
