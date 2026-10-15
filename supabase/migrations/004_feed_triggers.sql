-- ================================================================
-- TrailMate – Migration 004: Feed Triggers & Functions
-- Likes count, comments count, saves count, report auto-hide
-- ================================================================

-- ─── Likes Count Trigger ───────────────────────────────────

CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_likes_count ON likes;
CREATE TRIGGER trigger_likes_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_likes_count();

-- ─── Comments Count Trigger ────────────────────────────────

CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_comments_count ON comments;
CREATE TRIGGER trigger_comments_count
AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_comments_count();

-- ─── Saves/Bookmarks Count Trigger ─────────────────────────

CREATE OR REPLACE FUNCTION update_saves_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET saves_count = saves_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET saves_count = saves_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_saves_count ON bookmarks;
CREATE TRIGGER trigger_saves_count
AFTER INSERT OR DELETE ON bookmarks
FOR EACH ROW EXECUTE FUNCTION update_saves_count();

-- ─── Auto-Hide Posts with 3+ Reports ───────────────────────

CREATE OR REPLACE FUNCTION check_report_threshold()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT reporter_id) INTO report_count
    FROM reports
    WHERE post_id = NEW.post_id AND status = 'pending';

    IF report_count >= 3 THEN
      UPDATE posts SET is_hidden = true WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_reports ON reports;
CREATE TRIGGER trigger_check_reports
AFTER INSERT ON reports
FOR EACH ROW EXECUTE FUNCTION check_report_threshold();

-- ─── Add is_hidden column to posts if not exists ───────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE posts ADD COLUMN is_hidden BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ─── Explore Feed Score Function ───────────────────────────

CREATE OR REPLACE FUNCTION get_explore_feed(
  p_user_id UUID,
  p_user_region TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  media_urls JSONB,
  route_id UUID,
  location GEOMETRY,
  group_id UUID,
  community_id UUID,
  created_at TIMESTAMPTZ,
  likes_count INTEGER,
  comments_count INTEGER,
  saves_count INTEGER,
  is_hidden BOOLEAN,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  score DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.user_id, p.content, p.media_urls, p.route_id,
    p.location, p.group_id, p.community_id, p.created_at,
    p.likes_count, p.comments_count, p.saves_count, p.is_hidden,
    u.username, u.display_name, u.avatar_url,
    (
      (p.likes_count * 2 + p.comments_count * 3 + p.saves_count * 4)::DOUBLE PRECISION
      * (1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 * 0.05))
      * CASE WHEN p_user_region IS NOT NULL AND u.home_region = p_user_region THEN 1.5 ELSE 1.0 END
    ) AS score
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.group_id IS NULL
    AND p.community_id IS NULL
    AND u.is_private = false
    AND COALESCE(p.is_hidden, false) = false
    AND p.user_id != p_user_id
    AND p.user_id NOT IN (
      SELECT blocked_id FROM blocks WHERE blocker_id = p_user_id
      UNION
      SELECT blocker_id FROM blocks WHERE blocked_id = p_user_id
    )
  ORDER BY score DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Index for feed performance ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_posts_hidden ON posts(is_hidden) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_likes_user_post ON likes(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_post ON bookmarks(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_post_status ON reports(post_id, status) WHERE status = 'pending';
