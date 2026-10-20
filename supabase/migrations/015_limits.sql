-- 015: Beitrags- und Nachrichtenlimit serverseitig durchsetzen
-- (docs/ist-soll/06.md, Empfohlene Aufgabe 6 und Sicherheitsauffälligkeit 3)
--
-- 1. posts: höchstens 5 Beiträge pro Konto in 60 Minuten; gleicher Text vom
--    selben Konto innerhalb 24 Stunden wird abgelehnt (leere Texte ausgenommen).
-- 2. direct_messages: höchstens 50 Nachrichten pro Absender in 24 Stunden.
-- In beiden Fällen setzt der Server created_at selbst, damit Clients die
-- Limits nicht durch Zurückdatieren umgehen.
--
-- Down (zerstört keine Daten):
--   DROP TRIGGER IF EXISTS trg_posts_limits ON posts;
--   DROP TRIGGER IF EXISTS trg_posts_keep_created_at ON posts;
--   DROP TRIGGER IF EXISTS trg_direct_messages_daily_limit ON direct_messages;
--   DROP FUNCTION IF EXISTS enforce_post_limits();
--   DROP FUNCTION IF EXISTS keep_post_created_at();
--   DROP FUNCTION IF EXISTS enforce_direct_message_daily_limit();
--   DROP INDEX IF EXISTS idx_posts_user_created;
--   DROP INDEX IF EXISTS idx_dm_sender_created;

-- ============================================================
-- 1. Beiträge: Stundenlimit und Duplikat-Sperre
-- ============================================================

-- SECURITY DEFINER, damit auch ausgeblendete oder für den Aufrufer
-- unsichtbare eigene Beiträge mitzählen.
CREATE OR REPLACE FUNCTION enforce_post_limits()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Clients dürfen created_at nicht zurückdatieren, sonst zählt das Limit
  -- den Beitrag nicht (Service-Rolle und Migrationen ohne auth.uid() schon).
  IF auth.uid() IS NOT NULL THEN
    NEW.created_at := NOW();
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM posts
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - INTERVAL '60 minutes';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Limit erreicht: höchstens 5 Beiträge pro Stunde.'
      USING ERRCODE = 'check_violation',
            HINT = 'post_hourly_limit';
  END IF;

  IF NULLIF(btrim(NEW.content), '') IS NOT NULL AND EXISTS (
    SELECT 1 FROM posts
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '24 hours'
      AND btrim(content) = btrim(NEW.content)
  ) THEN
    RAISE EXCEPTION 'Diesen Beitrag hast du in den letzten 24 Stunden schon veröffentlicht.'
      USING ERRCODE = 'check_violation',
            HINT = 'post_duplicate';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_posts_limits ON posts;
CREATE TRIGGER trg_posts_limits
  BEFORE INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_post_limits();

CREATE INDEX IF NOT EXISTS idx_posts_user_created
  ON posts (user_id, created_at DESC);

-- Eigene Beiträge dürfen bearbeitet werden (posts_update), created_at aber
-- nicht nachträglich zurückdatiert.
CREATE OR REPLACE FUNCTION keep_post_created_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_posts_keep_created_at ON posts;
CREATE TRIGGER trg_posts_keep_created_at
  BEFORE UPDATE OF created_at ON posts
  FOR EACH ROW
  EXECUTE FUNCTION keep_post_created_at();

-- ============================================================
-- 2. Direktnachrichten: Tageslimit
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_direct_message_daily_limit()
RETURNS TRIGGER AS $$
DECLARE
  sent_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_at := NOW();
  END IF;

  SELECT COUNT(*) INTO sent_count
  FROM direct_messages
  WHERE sender_id = NEW.sender_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF sent_count >= 50 THEN
    RAISE EXCEPTION 'Tageslimit erreicht: höchstens 50 Direktnachrichten pro 24 Stunden.'
      USING ERRCODE = 'check_violation',
            HINT = 'direct_message_daily_limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_direct_messages_daily_limit ON direct_messages;
CREATE TRIGGER trg_direct_messages_daily_limit
  BEFORE INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_direct_message_daily_limit();

-- idx_dm_sender aus 001 deckt nur sender_id ab (005 legt ihn wegen
-- IF NOT EXISTS nicht neu an), daher ein eigener Index mit Zeit.
CREATE INDEX IF NOT EXISTS idx_dm_sender_created
  ON direct_messages (sender_id, created_at DESC);
