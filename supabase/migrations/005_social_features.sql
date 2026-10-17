-- ============================================================
-- 005 Social Features: Zusätzliche RLS-Policies, Hilfsfunktionen,
-- Trigger und Indizes für Social-Features (Doc 06)
-- ============================================================

-- ============================================================
-- Hilfsfunktionen
-- ============================================================

-- Gegenseitiges Follow prüfen (Alias für DM-Zugang)
CREATE OR REPLACE FUNCTION check_mutual_follow(user1 UUID, user2 UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM follows WHERE follower_id = user1 AND following_id = user2
  ) AND EXISTS (
    SELECT 1 FROM follows WHERE follower_id = user2 AND following_id = user1
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Blockierte User-IDs als Array zurückgeben (für Client-seitiges Filtern)
CREATE OR REPLACE FUNCTION get_blocked_user_ids(p_user_id UUID)
RETURNS UUID[] AS $$
  SELECT COALESCE(
    array_agg(
      CASE
        WHEN blocker_id = p_user_id THEN blocked_id
        ELSE blocker_id
      END
    ),
    ARRAY[]::UUID[]
  )
  FROM blocks
  WHERE blocker_id = p_user_id OR blocked_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Follower-Entfernung: Erlaubt dem Zielbenutzer, einen Follower zu löschen
-- (Ergänzung zur bestehenden follows_delete Policy)
-- ============================================================
CREATE POLICY follows_delete_by_target ON follows FOR DELETE USING (
  following_id = auth.uid()
);

-- ============================================================
-- Trigger: Automatische Benachrichtigung bei neuem Follower
-- ============================================================
CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_follower ON follows;
CREATE TRIGGER trg_notify_new_follower
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_follower();

-- ============================================================
-- Trigger: Automatische Benachrichtigung bei neuer DM
-- ============================================================
CREATE OR REPLACE FUNCTION notify_new_dm()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_dm ON direct_messages;
CREATE TRIGGER trg_notify_new_dm
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_dm();

-- ============================================================
-- Trigger: Post ausblenden wenn report_count >= 3
-- ============================================================

-- Zähler-Spalte auf posts, falls nicht vorhanden
DO $$ BEGIN
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION increment_report_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    UPDATE posts
    SET report_count = report_count + 1,
        is_hidden = CASE WHEN report_count + 1 >= 3 THEN TRUE ELSE is_hidden END
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_report_count ON reports;
CREATE TRIGGER trg_increment_report_count
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION increment_report_count();

-- ============================================================
-- Trigger: Benachrichtigung bei Follow-Request
-- ============================================================
CREATE OR REPLACE FUNCTION notify_follow_request()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_follow_request ON follow_requests;
CREATE TRIGGER trg_notify_follow_request
  AFTER INSERT ON follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_follow_request();

-- ============================================================
-- Trigger: Benachrichtigung bei Gruppen-Event
-- ============================================================
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
    AND gm.user_id != NEW.created_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_group_event ON group_events;
CREATE TRIGGER trg_notify_group_event
  AFTER INSERT ON group_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_group_event();

-- ============================================================
-- Performance-Indizes
-- ============================================================

-- Follows
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id);
CREATE INDEX IF NOT EXISTS idx_follows_pair ON follows (follower_id, following_id);

-- Follow Requests
CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON follow_requests (target_id, status);
CREATE INDEX IF NOT EXISTS idx_follow_requests_requester ON follow_requests (requester_id, status);

-- Blocks
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id);

-- DMs
CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_unread ON direct_messages (receiver_id, is_read) WHERE NOT is_read;

-- Post Messages
CREATE INDEX IF NOT EXISTS idx_post_messages_post ON post_messages (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_messages_receiver ON post_messages (receiver_id, is_read);

-- Groups
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_group ON group_join_requests (group_id, status);

-- Group Events
CREATE INDEX IF NOT EXISTS idx_group_events_group ON group_events (group_id, event_date);
-- Kein WHERE event_date > NOW(): Postgres erlaubt nur IMMUTABLE-Funktionen im Index-Prädikat.
CREATE INDEX IF NOT EXISTS idx_group_events_date ON group_events (event_date);
CREATE INDEX IF NOT EXISTS idx_event_responses_event ON event_responses (event_id);

-- Communities
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members (community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members (user_id);
CREATE INDEX IF NOT EXISTS idx_community_join_requests_community ON community_join_requests (community_id, status);
CREATE INDEX IF NOT EXISTS idx_communities_region ON communities (region);
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities (category);

-- Reports
CREATE INDEX IF NOT EXISTS idx_reports_post ON reports (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status) WHERE status = 'pending';

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, is_read) WHERE NOT is_read;

-- Posts Report Count
CREATE INDEX IF NOT EXISTS idx_posts_report_count ON posts (report_count) WHERE report_count >= 3;
