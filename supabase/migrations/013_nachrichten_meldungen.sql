-- 013: Post-Nachrichten und Meldungen gegen Missbrauch absichern
-- (docs/ist-soll/06.md, Sicherheitsauffälligkeiten 2 und 5)
--
-- 1. post_messages_insert: Nachrichten nur an den Besitzer des Beitrags oder
--    als Antwort des Besitzers an jemanden, der ihm dazu schon geschrieben hat.
-- 2. Tageslimit: höchstens 50 Post-Nachrichten pro Absender und 24 Stunden.
-- 3. reports: eine Meldung pro Person und Beitrag/Kommentar; Auto-Ausblenden
--    zählt verschiedene Meldende statt Zeilen.
--
-- Down (zerstört Daten: doppelte Meldungen werden gelöscht, nicht wiederherstellbar):
--   DROP INDEX IF EXISTS reports_unique_reporter_post;
--   DROP INDEX IF EXISTS reports_unique_reporter_comment;
--   DROP TRIGGER IF EXISTS trg_post_messages_daily_limit ON post_messages;
--   DROP FUNCTION IF EXISTS enforce_post_message_daily_limit();
--   DROP FUNCTION IF EXISTS can_send_post_message(UUID, UUID);
--   Policy post_messages_insert und increment_report_count wie in 002/005.

-- ============================================================
-- 1. post_messages_insert
-- ============================================================

-- SECURITY DEFINER, damit die Prüfung nicht von der Sichtbarkeit des
-- Beitrags bzw. der bisherigen Nachrichten für den Aufrufer abhängt.
CREATE OR REPLACE FUNCTION can_send_post_message(p_post_id UUID, p_receiver_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM posts p
    WHERE p.id = p_post_id
      AND (
        -- Nachricht an den Besitzer des Beitrags
        p.user_id = p_receiver_id
        -- Antwort des Besitzers an jemanden, der ihm dazu geschrieben hat
        OR (
          p.user_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM post_messages m
            WHERE m.post_id = p_post_id
              AND m.sender_id = p_receiver_id
              AND m.receiver_id = auth.uid()
          )
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS post_messages_insert ON post_messages;
CREATE POLICY post_messages_insert ON post_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND receiver_id <> auth.uid()
  AND NOT is_blocked(auth.uid(), receiver_id)
  AND can_send_post_message(post_id, receiver_id)
);

-- ============================================================
-- 2. Tageslimit für Post-Nachrichten
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_post_message_daily_limit()
RETURNS TRIGGER AS $$
DECLARE
  sent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO sent_count
  FROM post_messages
  WHERE sender_id = NEW.sender_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF sent_count >= 50 THEN
    RAISE EXCEPTION 'Tageslimit erreicht: höchstens 50 Post-Nachrichten pro 24 Stunden.'
      USING ERRCODE = 'check_violation',
            HINT = 'post_message_daily_limit';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_post_messages_daily_limit ON post_messages;
CREATE TRIGGER trg_post_messages_daily_limit
  BEFORE INSERT ON post_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_post_message_daily_limit();

CREATE INDEX IF NOT EXISTS idx_post_messages_sender_created
  ON post_messages (sender_id, created_at DESC);

-- ============================================================
-- 3. Meldungen: eine pro Person und Ziel
-- ============================================================

-- Vorhandene Duplikate entfernen (die älteste Meldung bleibt)
DELETE FROM reports r
USING reports older
WHERE r.reporter_id = older.reporter_id
  AND r.post_id = older.post_id
  AND (older.created_at, older.id) < (r.created_at, r.id);

DELETE FROM reports r
USING reports older
WHERE r.reporter_id = older.reporter_id
  AND r.comment_id = older.comment_id
  AND (older.created_at, older.id) < (r.created_at, r.id);

CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_reporter_post
  ON reports (reporter_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_reporter_comment
  ON reports (reporter_id, comment_id) WHERE comment_id IS NOT NULL;

-- Zähler zählt verschiedene Meldende statt Zeilen
CREATE OR REPLACE FUNCTION increment_report_count()
RETURNS TRIGGER AS $$
DECLARE
  reporter_count INTEGER;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT reporter_id) INTO reporter_count
    FROM reports
    WHERE post_id = NEW.post_id;

    UPDATE posts
    SET report_count = reporter_count,
        is_hidden = CASE WHEN reporter_count >= 3 THEN TRUE ELSE is_hidden END
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bestehende Zähler an die bereinigten Meldungen angleichen
-- (bereits ausgeblendete Beiträge bleiben ausgeblendet)
UPDATE posts p
SET report_count = sub.reporter_count
FROM (
  SELECT post_id, COUNT(DISTINCT reporter_id)::INTEGER AS reporter_count
  FROM reports
  WHERE post_id IS NOT NULL
  GROUP BY post_id
) sub
WHERE p.id = sub.post_id
  AND p.report_count IS DISTINCT FROM sub.reporter_count;
