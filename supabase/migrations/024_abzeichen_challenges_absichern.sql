-- ============================================================
-- Migration 024: Abzeichen- und Challenge-Funktionen absichern
-- Ist-Soll 08, Sicherheitsauffälligkeiten 2 und 3, Aufgabe 2 (+ Zeitraum aus 9)
-- ============================================================
-- Before: award_badge (007) vergibt jedem beliebige Abzeichen samt
-- Benachrichtigung an fremde Konten. update_challenge_progress (007)
-- übernimmt p_progress blind für jede Person; dazu setzt die App
-- challenge_participants.progress direkt per UPDATE (002, 007).
-- After: Beide Funktionen nur noch für das eigene Konto (oder ohne
-- Anmeldung, also serverseitig). Der Fortschritt wird aus recordings im
-- Zeitraum der Challenge berechnet; progress und completed_at sind für
-- Clients nicht setzbar.

CREATE OR REPLACE FUNCTION award_badge(p_user_id UUID, p_badge_id VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name VARCHAR;
BEGIN
  -- Ohne auth.uid() (Server, Trigger ohne Anmeldung) bleibt die Vergabe erlaubt.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Abzeichen nur für das eigene Konto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT name INTO v_name FROM badges WHERE id = p_badge_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO user_badges (user_id, badge_id)
  VALUES (p_user_id, p_badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  -- Benachrichtigung nur bei einem neuen Abzeichen
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (p_user_id, 'badge',
          'Neues Abzeichen!',
          'Du hast "' || v_name || '" verdient! 🏆',
          jsonb_build_object('badge_id', p_badge_id, 'badge_name', v_name));
  RETURN TRUE;
END;
$$;

-- p_progress wird ignoriert und bleibt nur, damit die App (lib/badgeEngine.ts)
-- unverändert aufrufen kann. Der Fortschritt kommt aus recordings.
CREATE OR REPLACE FUNCTION update_challenge_progress(
  p_user_id UUID,
  p_challenge_id UUID,
  p_progress FLOAT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c challenges%ROWTYPE;
  v_progress FLOAT;
  v_target FLOAT;
  v_done_before TIMESTAMPTZ;
  v_completed BOOLEAN;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Fortschritt nur für das eigene Konto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO c FROM challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT completed_at INTO v_done_before FROM challenge_participants
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  FOR UPDATE;  -- parallele Aufrufe schliessen nicht doppelt ab
  IF NOT FOUND THEN
    RETURN;  -- nimmt nicht teil
  END IF;

  -- c.region bleibt vorerst unberücksichtigt (Touren haben noch keine Region).
  SELECT CASE c.type
           WHEN 'distance'  THEN COALESCE(SUM(r.distance_m), 0) / 1000.0
           WHEN 'elevation' THEN COALESCE(SUM(r.elevation_gain_m), 0)
           WHEN 'tours'     THEN COUNT(*)
         END
  INTO v_progress
  FROM recordings r
  WHERE r.user_id = p_user_id
    AND r.is_hidden = FALSE
    AND (c.start_date IS NULL OR r.started_at >= c.start_date)
    -- + 1 Tag, damit Touren am letzten Tag noch zählen
    AND (c.end_date IS NULL OR r.started_at < c.end_date + INTERVAL '1 day');

  IF v_progress IS NULL THEN
    RETURN;  -- unbekannter Typ
  END IF;

  v_target := (c.goal->>'target')::FLOAT;
  v_completed := v_done_before IS NULL AND v_target IS NOT NULL
                 AND v_progress >= v_target;

  UPDATE challenge_participants
  SET progress = v_progress,
      completed_at = CASE WHEN v_completed THEN NOW() ELSE completed_at END
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

  -- Abzeichen und Benachrichtigung nur im Moment des Abschlusses
  IF v_completed THEN
    IF c.badge_id IS NOT NULL THEN
      PERFORM award_badge(p_user_id, c.badge_id);
    END IF;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (p_user_id, 'challenge',
            'Challenge geschafft! 🎉',
            'Du hast "' || c.title || '" abgeschlossen!',
            jsonb_build_object('challenge_id', p_challenge_id));
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION award_badge(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION award_badge(UUID, VARCHAR) TO authenticated;
REVOKE EXECUTE ON FUNCTION update_challenge_progress(UUID, UUID, FLOAT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_challenge_progress(UUID, UUID, FLOAT) TO authenticated;

-- progress und completed_at nur serverseitig (Muster aus 009)
CREATE OR REPLACE FUNCTION protect_challenge_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.progress := 0;
    NEW.completed_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.progress IS DISTINCT FROM OLD.progress
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'progress und completed_at werden nur serverseitig gesetzt'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS challenge_participants_protect_progress ON challenge_participants;
CREATE TRIGGER challenge_participants_protect_progress
  BEFORE INSERT OR UPDATE ON challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION protect_challenge_progress();

-- Down:
-- DROP TRIGGER IF EXISTS challenge_participants_protect_progress ON challenge_participants;
-- DROP FUNCTION IF EXISTS protect_challenge_progress();
-- Funktionen award_badge und update_challenge_progress aus 007 wiederherstellen.
