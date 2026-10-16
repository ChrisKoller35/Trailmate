-- Test für Migration 010. Läuft gegen eine Datenbank mit allen Migrationen
-- (z. B. lokales Supabase): psql "$DB_URL" -v ON_ERROR_STOP=1 -f <diese Datei>
-- Alles läuft in einer Transaktion und wird am Ende zurückgerollt.

BEGIN;

INSERT INTO users (id, username) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'test_priv_a'),
  ('00000000-0000-0000-0000-0000000000b2', 'test_priv_b');
INSERT INTO user_private (user_id, email, push_token) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.invalid', 'tok-a'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@test.invalid', 'tok-b');

-- Als Konto A anmelden
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- users und public_profiles haben keine privaten Spalten mehr
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name IN ('users', 'public_profiles')
      AND column_name IN ('email', 'push_token')
  ) THEN
    RAISE EXCEPTION 'FEHLER: email/push_token noch in users oder public_profiles';
  END IF;

  -- A sieht das öffentliche Profil von B, aber nicht dessen private Zeile
  IF NOT EXISTS (SELECT 1 FROM public_profiles WHERE id = '00000000-0000-0000-0000-0000000000b2') THEN
    RAISE EXCEPTION 'FEHLER: öffentliches Profil von B nicht lesbar';
  END IF;
  IF EXISTS (SELECT 1 FROM user_private WHERE user_id = '00000000-0000-0000-0000-0000000000b2') THEN
    RAISE EXCEPTION 'FEHLER: A kann E-Mail/Push-Token von B lesen';
  END IF;

  -- A liest die eigene Zeile
  IF (SELECT email FROM user_private WHERE user_id = '00000000-0000-0000-0000-0000000000a1')
     IS DISTINCT FROM 'a@test.invalid' THEN
    RAISE EXCEPTION 'FEHLER: eigene E-Mail nicht lesbar';
  END IF;

  -- A kann den Push-Token von B nicht überschreiben
  UPDATE user_private SET push_token = 'boese'
  WHERE user_id = '00000000-0000-0000-0000-0000000000b2';

  RAISE NOTICE 'ok: private Felder nur für die eigene Zeile';
END $$;

RESET ROLE;

DO $$
BEGIN
  IF (SELECT push_token FROM user_private WHERE user_id = '00000000-0000-0000-0000-0000000000b2')
     <> 'tok-b' THEN
    RAISE EXCEPTION 'FEHLER: Push-Token von B wurde von A geändert';
  END IF;
  RAISE NOTICE 'ok: fremder Push-Token unverändert';
END $$;

ROLLBACK;
