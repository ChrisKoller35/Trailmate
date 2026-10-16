-- Test für Migration 009. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.

BEGIN;

INSERT INTO users (id, username, email)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'test_status_a', 'a@test.invalid');

SET LOCAL ROLE authenticated;

-- 1) Normales Konto kann sich nicht selbst auf Premium setzen
DO $$
BEGIN
  BEGIN
    UPDATE users SET is_premium = TRUE
    WHERE id = '00000000-0000-0000-0000-0000000000a1';
    RAISE EXCEPTION 'FEHLER: is_premium liess sich vom Client setzen';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: is_premium vom Client abgelehnt';
  END;

  BEGIN
    UPDATE users SET is_verified = TRUE
    WHERE id = '00000000-0000-0000-0000-0000000000a1';
    RAISE EXCEPTION 'FEHLER: is_verified liess sich vom Client setzen';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok: is_verified vom Client abgelehnt';
  END;
END $$;

-- 2) Andere Felder bleiben änderbar (z. B. Bio, wie edit-profile)
UPDATE users SET bio = 'Hallo'
WHERE id = '00000000-0000-0000-0000-0000000000a1';

-- 3) Beim Anlegen werden die Felder auf FALSE gezwungen
INSERT INTO users (id, username, email, is_premium, is_verified)
VALUES ('00000000-0000-0000-0000-0000000000b2', 'test_status_b', 'b@test.invalid', TRUE, TRUE);

RESET ROLE;

DO $$
BEGIN
  IF (SELECT is_premium OR is_verified FROM users
      WHERE id = '00000000-0000-0000-0000-0000000000b2') THEN
    RAISE EXCEPTION 'FEHLER: INSERT vom Client setzte Statusfelder';
  END IF;
  IF (SELECT bio FROM users WHERE id = '00000000-0000-0000-0000-0000000000a1') <> 'Hallo' THEN
    RAISE EXCEPTION 'FEHLER: normales Profil-Update blockiert';
  END IF;
  RAISE NOTICE 'ok: INSERT erzwingt FALSE, Bio-Update geht';
END $$;

-- 4) Serverseitig (postgres/service_role) geht es weiterhin
UPDATE users SET is_premium = TRUE
WHERE id = '00000000-0000-0000-0000-0000000000a1';

ROLLBACK;
