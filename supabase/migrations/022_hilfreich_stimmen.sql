-- ============================================================
-- Migration 022: «Hilfreich» bei Wegberichten nur einmal pro Person
-- Ist-Soll 07, Sicherheitsauffälligkeit 1, Aufgabe 5
-- ============================================================
-- Before: upvote_trail_condition (006) zählt ohne Login beliebig oft hoch,
-- auch beim eigenen Bericht; Verfasser setzen den Score per UPDATE (002).
-- After: eine Stimme pro Person in trail_condition_votes, geschrieben nur
-- über die Funktion; der Score ist die Anzahl Stimmen und für Clients
-- nicht setzbar.

CREATE TABLE IF NOT EXISTS trail_condition_votes (
  condition_id UUID REFERENCES trail_conditions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (condition_id, user_id)
);

ALTER TABLE trail_condition_votes ENABLE ROW LEVEL SECURITY;

-- Nur lesen, nur die eigenen; kein INSERT/UPDATE/DELETE für Clients.
DROP POLICY IF EXISTS trail_condition_votes_select ON trail_condition_votes;
CREATE POLICY trail_condition_votes_select ON trail_condition_votes
  FOR SELECT USING (user_id = auth.uid());

-- TRUE, wenn die Stimme neu war, sonst FALSE.
DROP FUNCTION IF EXISTS upvote_trail_condition(UUID);
CREATE FUNCTION upvote_trail_condition(p_condition_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_author UUID;
  v_inserted INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT user_id INTO v_author FROM trail_conditions WHERE id = p_condition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bericht nicht gefunden' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_author = v_uid THEN
    RAISE EXCEPTION 'Eigener Bericht' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_author IS NOT NULL AND is_blocked(v_uid, v_author) THEN
    RAISE EXCEPTION 'Bericht nicht verfügbar' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO trail_condition_votes (condition_id, user_id)
  VALUES (p_condition_id, v_uid)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  UPDATE trail_conditions
  SET helpfulness_score = (
    SELECT COUNT(*) FROM trail_condition_votes WHERE condition_id = p_condition_id
  )
  WHERE id = p_condition_id;

  RETURN v_inserted > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION upvote_trail_condition(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upvote_trail_condition(UUID) TO authenticated;

-- helpfulness_score nur serverseitig (Muster aus 009)
CREATE OR REPLACE FUNCTION protect_trail_condition_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.helpfulness_score := 0;
  ELSIF NEW.helpfulness_score IS DISTINCT FROM OLD.helpfulness_score THEN
    RAISE EXCEPTION 'helpfulness_score wird nur serverseitig gesetzt'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trail_conditions_protect_score ON trail_conditions;
CREATE TRIGGER trail_conditions_protect_score
  BEFORE INSERT OR UPDATE ON trail_conditions
  FOR EACH ROW
  EXECUTE FUNCTION protect_trail_condition_score();

-- Alte Scores waren beliebig hochzählbar. Beim ersten Lauf gibt es keine
-- Stimmen, also wird jeder Score 0; ein erneuter Lauf zählt die Stimmen.
UPDATE trail_conditions t
SET helpfulness_score = (
  SELECT COUNT(*) FROM trail_condition_votes v WHERE v.condition_id = t.id
);

-- Down (alte Scores sind verloren):
-- DROP TRIGGER IF EXISTS trail_conditions_protect_score ON trail_conditions;
-- DROP FUNCTION IF EXISTS protect_trail_condition_score();
-- DROP FUNCTION IF EXISTS upvote_trail_condition(UUID);
-- DROP TABLE IF EXISTS trail_condition_votes;
