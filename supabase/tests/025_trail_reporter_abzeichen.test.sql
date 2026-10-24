-- Test für Migration 025. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: A = meldet Wegzustände, B = meldet nichts

BEGIN;

INSERT INTO users (id, username) VALUES
  ('00000000-0000-0000-0000-0000000025a1', 'test_25_melder'),
  ('00000000-0000-0000-0000-0000000025b2', 'test_25_b');

-- ── Alte Abzeichen sind weg ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM badges WHERE category = 'community') THEN
    RAISE EXCEPTION 'FEHLER: Kategorie community noch vorhanden';
  END IF;
  RAISE NOTICE 'ok: keine Kategorie community mehr';
  IF EXISTS (SELECT 1 FROM user_badges
             WHERE badge_id IN ('badge-trail-reporter', 'badge-pfadfinder')) THEN
    RAISE EXCEPTION 'FEHLER: user_badges enthält alte Abzeichen';
  END IF;
  RAISE NOTICE 'ok: keine alten Abzeichen in user_badges';
END $$;

-- ── A meldet als sich selbst ────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000025a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- Jeder Bericht in einer eigenen Anweisung, damit der Trigger pro Bericht
-- den aktuellen Stand zählt.
DO $$
DECLARE
  a UUID := '00000000-0000-0000-0000-0000000025a1';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    INSERT INTO trail_conditions (user_id, comment) VALUES (a, 'Bericht ' || i);
  END LOOP;
  IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = a) THEN
    RAISE EXCEPTION 'FEHLER: Abzeichen nach 4 Berichten';
  END IF;
  RAISE NOTICE 'ok: nach 4 Berichten kein Abzeichen';

  INSERT INTO trail_conditions (user_id, comment) VALUES (a, 'Bericht 5');
  IF (SELECT COUNT(*) FROM user_badges
      WHERE user_id = a AND badge_id = 'trail_reporter_5') <> 1
     OR (SELECT COUNT(*) FROM user_badges WHERE user_id = a) <> 1 THEN
    RAISE EXCEPTION 'FEHLER: nach 5 Berichten nicht genau trail_reporter_5';
  END IF;
  IF (SELECT COUNT(*) FROM notifications
      WHERE user_id = a AND type = 'badge') <> 1 THEN
    RAISE EXCEPTION 'FEHLER: nach 5 Berichten nicht genau eine Benachrichtigung';
  END IF;
  RAISE NOTICE 'ok: 5. Bericht gibt trail_reporter_5 mit einer Benachrichtigung';

  INSERT INTO trail_conditions (user_id, comment) VALUES (a, 'Bericht 6');
  IF (SELECT COUNT(*) FROM user_badges WHERE user_id = a) <> 1
     OR (SELECT COUNT(*) FROM notifications
         WHERE user_id = a AND type = 'badge') <> 1 THEN
    RAISE EXCEPTION 'FEHLER: 6. Bericht hat etwas geändert';
  END IF;
  RAISE NOTICE 'ok: 6. Bericht ändert nichts';

  FOR i IN 7..25 LOOP
    INSERT INTO trail_conditions (user_id, comment) VALUES (a, 'Bericht ' || i);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM user_badges
                 WHERE user_id = a AND badge_id = 'trail_reporter_25')
     OR (SELECT COUNT(*) FROM user_badges WHERE user_id = a) <> 2
     OR (SELECT COUNT(*) FROM notifications
         WHERE user_id = a AND type = 'badge') <> 2 THEN
    RAISE EXCEPTION 'FEHLER: nach 25 Berichten fehlt trail_reporter_25';
  END IF;
  RAISE NOTICE 'ok: 25. Bericht gibt zusätzlich trail_reporter_25';
END $$;

-- ── B hat nichts bekommen ───────────────────────────────────
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_badges
             WHERE user_id = '00000000-0000-0000-0000-0000000025b2')
     OR EXISTS (SELECT 1 FROM notifications
                WHERE user_id = '00000000-0000-0000-0000-0000000025b2') THEN
    RAISE EXCEPTION 'FEHLER: Abzeichen für ein fremdes Konto';
  END IF;
  RAISE NOTICE 'ok: kein Abzeichen für fremde Konten';
END $$;

ROLLBACK;
