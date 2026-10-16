-- ============================================================
-- Migration 010: Private Felder aus users lösen
-- Ist-Soll 01, STAND.md Schritt 3, Vorarbeit für Dokument 09 (Strang A8)
-- ============================================================
-- Before: users.email und users.push_token waren für alle lesbar, die das
-- Profil sehen dürfen (Policy users_select, öffentliche Profile = alle).
-- After: Beide Felder liegen in user_private, lesbar und änderbar nur für die
-- eigene Zeile. users enthält nur noch öffentliche Profilfelder; die View
-- public_profiles ist der vorgesehene Weg, fremde Profile zu lesen.
-- Die E-Mail für Login und Konto kommt aus auth.users (Supabase Auth).

CREATE TABLE IF NOT EXISTS user_private (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  push_token TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_private_select ON user_private;
CREATE POLICY user_private_select ON user_private FOR SELECT USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS user_private_insert ON user_private;
CREATE POLICY user_private_insert ON user_private FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS user_private_update ON user_private;
CREATE POLICY user_private_update ON user_private FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS user_private_delete ON user_private;
CREATE POLICY user_private_delete ON user_private FOR DELETE USING (
  user_id = auth.uid()
);

-- Bestehende Werte übernehmen, dann die Spalten aus users entfernen.
-- Down (Daten bleiben in user_private erhalten):
--   ALTER TABLE users ADD COLUMN email VARCHAR(255), ADD COLUMN push_token TEXT;
--   UPDATE users u SET email = p.email, push_token = p.push_token
--     FROM user_private p WHERE p.user_id = u.id;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'
  ) THEN
    INSERT INTO user_private (user_id, email, push_token)
    SELECT id, email, push_token FROM users
    ON CONFLICT (user_id) DO NOTHING;

    ALTER TABLE users DROP COLUMN email;
    ALTER TABLE users DROP COLUMN push_token;
  END IF;
END $$;

-- Öffentliche Sicht auf Profile. security_invoker: es gelten die RLS-Regeln
-- von users (Blockieren, private Profile) für die abfragende Person.
CREATE OR REPLACE VIEW public_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  cover_image_url,
  bio,
  home_region,
  hiking_level,
  is_premium,
  is_private,
  is_verified,
  created_at
FROM users;

GRANT SELECT ON public_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_private TO authenticated;
