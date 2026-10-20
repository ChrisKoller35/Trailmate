-- ============================================================
-- 016: Benachrichtigungen für Likes und Kommentare,
--      Einstellungen (users.notification_prefs) wirksam machen
-- ============================================================
-- Ist-Soll 06, Empfohlene Aufgabe 7.
--
-- 1. wants_notification(user_id, key) liest notification_prefs ->> key.
--    Fehlt der Schlüssel (oder ist er kein Boolean), gilt der Standard aus
--    DEFAULT_PREFS in app/notification-settings.tsx.
-- 2. Neue Trigger notify_like und notify_comment.
-- 3. Die Trigger-Funktionen aus 005 prüfen den passenden Schalter;
--    ihre Logik bleibt sonst unverändert.

-- ─── 1. Hilfsfunktion ────────────────────────────────────────
CREATE OR REPLACE FUNCTION wants_notification(p_user_id UUID, p_key TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (
      SELECT (notification_prefs ->> p_key)::BOOLEAN
      FROM users
      WHERE id = p_user_id
        AND jsonb_typeof(notification_prefs -> p_key) = 'boolean'
    ),
    -- Standardwerte wie DEFAULT_PREFS in app/notification-settings.tsx.
    -- Unbekannte Schlüssel (z. B. group_event, noch ohne Schalter) sind an.
    CASE p_key
      WHEN 'likes' THEN FALSE
      WHEN 'comments' THEN FALSE
      WHEN 'challenge_update' THEN FALSE
      ELSE TRUE
    END
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ─── 2. Like ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_like()
RETURNS TRIGGER AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM posts WHERE id = NEW.post_id;

  IF v_owner IS NULL
     OR v_owner = NEW.user_id
     OR is_blocked(v_owner, NEW.user_id)
     OR NOT wants_notification(v_owner, 'likes') THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_owner,
    'like',
    'Neues Like',
    (SELECT COALESCE(display_name, username) FROM users WHERE id = NEW.user_id),
    jsonb_build_object('post_id', NEW.post_id, 'user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_like ON likes;
CREATE TRIGGER trg_notify_like
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_like();

-- ─── 2. Kommentar ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM posts WHERE id = NEW.post_id;

  IF v_owner IS NULL
     OR v_owner = NEW.user_id
     OR is_blocked(v_owner, NEW.user_id)
     OR NOT wants_notification(v_owner, 'comments') THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_owner,
    'comment',
    'Neuer Kommentar',
    (SELECT COALESCE(display_name, username) FROM users WHERE id = NEW.user_id),
    jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id, 'user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_comment ON comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment();

-- ─── 3. Bestehende Trigger aus 005 an Schalter koppeln ───────
-- Die Trigger selbst bleiben bestehen, nur die Funktionen werden ersetzt.

CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT wants_notification(NEW.following_id, 'new_follower') THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.following_id,
    'follow',
    'Neuer Follower',
    (SELECT COALESCE(display_name, username) FROM users WHERE id = NEW.follower_id),
    jsonb_build_object('follower_id', NEW.follower_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION notify_follow_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT wants_notification(NEW.target_id, 'new_follower') THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.target_id,
    'follow',
    'Follow-Anfrage',
    (SELECT COALESCE(display_name, username) FROM users WHERE id = NEW.requester_id),
    jsonb_build_object('requester_id', NEW.requester_id, 'type', 'follow_request')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION notify_new_dm()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT wants_notification(NEW.receiver_id, 'dm') THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'dm',
    'Neue Nachricht',
    (SELECT COALESCE(display_name, username) FROM users WHERE id = NEW.sender_id),
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Für Gruppen-Events gibt es in app/notification-settings.tsx noch keinen
-- Schalter. Der Schlüssel group_event ist standardmässig an; das Verhalten
-- bleibt damit gleich, bis ein Schalter ergänzt wird.
CREATE OR REPLACE FUNCTION notify_group_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    gm.user_id,
    'event_reminder',
    'Neues Event: ' || NEW.title,
    (SELECT name FROM groups WHERE id = NEW.group_id),
    jsonb_build_object('event_id', NEW.id, 'group_id', NEW.group_id)
  FROM group_members gm
  WHERE gm.group_id = NEW.group_id
    AND gm.user_id != NEW.created_by
    AND wants_notification(gm.user_id, 'group_event');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
