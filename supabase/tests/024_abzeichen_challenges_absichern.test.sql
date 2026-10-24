-- Test für Migration 024. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.
-- Konten: A = handelt selbst, B = fremdes Konto

BEGIN;

INSERT INTO users (id, username) VALUES
  ('00000000-0000-0000-0000-0000000024a1', 'test_24_a'),
  ('00000000-0000-0000-0000-0000000024b2', 'test_24_b');
INSERT INTO challenges (id, title, type, goal, start_date, end_date) VALUES
  ('00000000-0000-0000-0000-00000000c024', 'Test 24', 'distance',
   '{"target": 10, "unit": "km"}', NOW() - INTERVAL '2 days', NOW() + INTERVAL '2 days');
INSERT INTO recordings (user_id, distance_m, started_at) VALUES
  ('00000000-0000-0000-0000-0000000024a1', 50000, NOW() - INTERVAL '10 days'),
  ('00000000-0000-0000-0000-0000000024a1', 12000, NOW() - INTERVAL '1 hour');

-- ── A: Abzeichen ────────────────────────────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000024a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  PERFORM award_badge('00000000-0000-0000-0000-0000000024b2', 'first_summit');
  RAISE EXCEPTION 'FEHLER: A hat B ein Abzeichen gegeben';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok: Abzeichen für fremdes Konto abgelehnt';
END $$;

-- Aufruf und Kontroll-Abfrage in getrennten Anweisungen: Eine Abfrage im
-- selben Ausdruck wie der Aufruf sieht noch den Stand vor dem Aufruf.
DO $$
DECLARE
  a UUID := '00000000-0000-0000-0000-0000000024a1';
  neu BOOLEAN;
BEGIN
  neu := award_badge(a, 'first_summit');
  IF NOT neu OR (SELECT COUNT(*) FROM notifications
                 WHERE user_id = a AND type = 'badge') <> 1 THEN
    RAISE EXCEPTION 'FEHLER: eigenes Abzeichen nicht vergeben';
  END IF;
  RAISE NOTICE 'ok: eigenes Abzeichen vergeben, eine Benachrichtigung';
  neu := award_badge(a, 'first_summit');
  IF neu OR (SELECT COUNT(*) FROM notifications
             WHERE user_id = a AND type = 'badge') <> 1 THEN
    RAISE EXCEPTION 'FEHLER: zweiter Aufruf vergibt erneut';
  END IF;
  RAISE NOTICE 'ok: zweiter Aufruf gibt FALSE, keine zweite Benachrichtigung';
  IF award_badge(a, 'gibt_es_nicht') THEN
    RAISE EXCEPTION 'FEHLER: unbekanntes Abzeichen vergeben';
  END IF;
  RAISE NOTICE 'ok: unbekanntes Abzeichen gibt FALSE';
END $$;

-- ── A: Challenge ────────────────────────────────────────────
INSERT INTO challenge_participants (challenge_id, user_id, progress) VALUES
  ('00000000-0000-0000-0000-00000000c024', '00000000-0000-0000-0000-0000000024a1', 999);

DO $$
DECLARE
  a UUID := '00000000-0000-0000-0000-0000000024a1';
  c UUID := '00000000-0000-0000-0000-00000000c024';
BEGIN
  IF (SELECT progress FROM challenge_participants
      WHERE challenge_id = c AND user_id = a) <> 0 THEN
    RAISE EXCEPTION 'FEHLER: Beitritt übernimmt progress aus der App';
  END IF;
  RAISE NOTICE 'ok: Beitritt beginnt bei 0';

  PERFORM update_challenge_progress(a, c, 9999);
  IF (SELECT progress FROM challenge_participants
      WHERE challenge_id = c AND user_id = a) <> 12
     OR (SELECT completed_at FROM challenge_participants
         WHERE challenge_id = c AND user_id = a) IS NULL
     OR (SELECT COUNT(*) FROM notifications
         WHERE user_id = a AND type = 'challenge') <> 1 THEN
    RAISE EXCEPTION 'FEHLER: Fortschritt nicht aus Touren im Zeitraum berechnet';
  END IF;
  RAISE NOTICE 'ok: Fortschritt 12, abgeschlossen, eine Benachrichtigung';

  PERFORM update_challenge_progress(a, c, 9999);
  IF (SELECT COUNT(*) FROM notifications
      WHERE user_id = a AND type = 'challenge') <> 1 THEN
    RAISE EXCEPTION 'FEHLER: zweiter Aufruf benachrichtigt erneut';
  END IF;
  RAISE NOTICE 'ok: zweiter Aufruf ohne neue Benachrichtigung';

  BEGIN
    UPDATE challenge_participants SET progress = 999
    WHERE challenge_id = c AND user_id = a;
    RAISE EXCEPTION 'FEHLER: progress per UPDATE gesetzt';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: progress per UPDATE abgelehnt';
  END;

  BEGIN
    PERFORM update_challenge_progress('00000000-0000-0000-0000-0000000024b2', c, 1);
    RAISE EXCEPTION 'FEHLER: Fortschritt für fremdes Konto';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: Fortschritt für fremdes Konto abgelehnt';
  END;
END $$;

-- ── anon: kein Aufruf ohne Login ────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;

DO $$
BEGIN
  PERFORM award_badge('00000000-0000-0000-0000-0000000024b2', 'first_summit');
  RAISE EXCEPTION 'FEHLER: anonymer Aufruf vergibt Abzeichen';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok: anonymer Aufruf abgelehnt';
END $$;

-- ── ohne Anmeldung (Server): Vergabe erlaubt, B unberührt bis hier ──
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);

DO $$
DECLARE b UUID := '00000000-0000-0000-0000-0000000024b2';
BEGIN
  IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = b)
     OR EXISTS (SELECT 1 FROM notifications WHERE user_id = b) THEN
    RAISE EXCEPTION 'FEHLER: B hat Abzeichen oder Benachrichtigung erhalten';
  END IF;
  RAISE NOTICE 'ok: B hat weder Abzeichen noch Benachrichtigung';
  IF NOT award_badge(b, 'first_summit') THEN
    RAISE EXCEPTION 'FEHLER: Vergabe ohne Anmeldung abgelehnt';
  END IF;
  RAISE NOTICE 'ok: ohne Anmeldung darf award_badge vergeben';
END $$;

ROLLBACK;
