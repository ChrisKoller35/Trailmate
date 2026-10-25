-- ============================================================
-- Migration 025: Trail-Reporter-Abzeichen vereinheitlichen
-- docs/ist-soll/07.md Aufgabe 6, docs/ist-soll/08.md
--
-- Für 5 und 25 Wegberichte gab es zwei Paare: 'badge-trail-reporter' und
-- 'badge-pfadfinder' (006, Kategorie community, vom Trigger direkt vergeben)
-- sowie 'trail_reporter_5' und 'trail_reporter_25' (007, Kategorie special,
-- von der App vergeben). Es bleibt nur das Paar aus 007.
--
-- 1. Wer ein altes Abzeichen hat, bekommt das neue mit dem alten earned_at,
--    ohne Benachrichtigung (das Abzeichen war schon da).
-- 2. Alte Zeilen in user_badges löschen, challenges umstellen, alte
--    Abzeichen aus badges löschen.
-- 3. check_trail_reporter_badges() vergibt über award_badge (Doppelte und
--    Benachrichtigung dort), nur für NEW.user_id, mit festem search_path.
--
-- Down (stellt die alten Abzeichen nicht wieder her, die Zuordnung bleibt
-- bei trail_reporter_5/25):
--   Funktionskörper aus 006 wieder einspielen und
--   ALTER FUNCTION check_trail_reporter_badges() SET search_path = public;
-- ============================================================

-- ─── 1. Alte Abzeichen übertragen ──────────────────────────
INSERT INTO user_badges (user_id, badge_id, earned_at)
SELECT ub.user_id,
       CASE ub.badge_id
         WHEN 'badge-trail-reporter' THEN 'trail_reporter_5'
         ELSE 'trail_reporter_25'
       END,
       ub.earned_at
FROM user_badges ub
WHERE ub.badge_id IN ('badge-trail-reporter', 'badge-pfadfinder')
ON CONFLICT DO NOTHING;

-- ─── 2. Alte Abzeichen entfernen ───────────────────────────
DELETE FROM user_badges
WHERE badge_id IN ('badge-trail-reporter', 'badge-pfadfinder');

UPDATE challenges SET badge_id = 'trail_reporter_5'
WHERE badge_id = 'badge-trail-reporter';
UPDATE challenges SET badge_id = 'trail_reporter_25'
WHERE badge_id = 'badge-pfadfinder';

DELETE FROM badges
WHERE id IN ('badge-trail-reporter', 'badge-pfadfinder');

-- ─── 3. Trigger-Funktion über award_badge ──────────────────
CREATE OR REPLACE FUNCTION check_trail_reporter_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_count INTEGER;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO report_count
  FROM trail_conditions
  WHERE user_id = NEW.user_id;

  IF report_count >= 5 THEN
    PERFORM award_badge(NEW.user_id, 'trail_reporter_5');
  END IF;

  IF report_count >= 25 THEN
    PERFORM award_badge(NEW.user_id, 'trail_reporter_25');
  END IF;

  RETURN NEW;
END;
$$;
