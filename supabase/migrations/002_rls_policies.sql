-- ============================================================
-- RLS Policies for TrailMate
-- Instagram-style blocking: blocked users see NOTHING
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiking_network ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_tracking_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper function: check if two users have a block relationship
-- Returns TRUE if there is a block in either direction
-- ============================================================
CREATE OR REPLACE FUNCTION is_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Helper function: check if viewer follows target
-- ============================================================
CREATE OR REPLACE FUNCTION is_following(viewer UUID, target UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = viewer AND following_id = target
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Helper function: check mutual follow (for DMs)
-- ============================================================
CREATE OR REPLACE FUNCTION is_mutual_follow(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM follows WHERE follower_id = user_a AND following_id = user_b
  ) AND EXISTS (
    SELECT 1 FROM follows WHERE follower_id = user_b AND following_id = user_a
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Helper function: check group membership
-- ============================================================
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Helper function: check community membership
-- ============================================================
CREATE OR REPLACE FUNCTION is_community_member(p_community_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- USERS
-- Public profiles visible to all (unless blocked)
-- Private profiles visible only to followers + self
-- ============================================================

-- SELECT: see users who haven't blocked you
CREATE POLICY users_select ON users FOR SELECT USING (
  -- Own profile always visible
  id = auth.uid()
  OR (
    -- Not blocked in either direction
    NOT is_blocked(auth.uid(), id)
    AND (
      -- Public profile: visible to all
      NOT is_private
      -- Private profile: only if viewer follows them
      OR is_following(auth.uid(), id)
    )
  )
);

-- INSERT: users can insert their own profile (triggered by auth signup)
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (
  id = auth.uid()
);

-- UPDATE: users can only update their own profile
CREATE POLICY users_update ON users FOR UPDATE USING (
  id = auth.uid()
) WITH CHECK (
  id = auth.uid()
);

-- DELETE: users can only delete their own profile
CREATE POLICY users_delete ON users FOR DELETE USING (
  id = auth.uid()
);

-- ============================================================
-- POSTS
-- Public posts visible to all (unless blocked)
-- Group posts only for group members
-- Community posts only for community members
-- ============================================================

CREATE POLICY posts_select ON posts FOR SELECT USING (
  -- Own posts always visible
  user_id = auth.uid()
  OR (
    NOT is_blocked(auth.uid(), user_id)
    AND (
      -- Regular post (no group/community): visible if user is public or viewer follows
      (group_id IS NULL AND community_id IS NULL AND (
        NOT (SELECT is_private FROM users WHERE id = posts.user_id)
        OR is_following(auth.uid(), user_id)
      ))
      -- Group post: visible only to group members
      OR (group_id IS NOT NULL AND is_group_member(group_id, auth.uid()))
      -- Community post: visible only to community members
      OR (community_id IS NOT NULL AND is_community_member(community_id, auth.uid()))
    )
  )
);

CREATE POLICY posts_insert ON posts FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY posts_update ON posts FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY posts_delete ON posts FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- COMMENTS
-- Visible where the parent post is visible
-- ============================================================

CREATE POLICY comments_select ON comments FOR SELECT USING (
  NOT is_blocked(auth.uid(), user_id)
  AND EXISTS (
    SELECT 1 FROM posts WHERE posts.id = comments.post_id
    -- RLS on posts will filter automatically
  )
);

CREATE POLICY comments_insert ON comments FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM posts WHERE posts.id = post_id
  )
);

CREATE POLICY comments_update ON comments FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY comments_delete ON comments FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- LIKES
-- Visible where the parent post is visible
-- ============================================================

CREATE POLICY likes_select ON likes FOR SELECT USING (
  NOT is_blocked(auth.uid(), user_id)
  AND EXISTS (
    SELECT 1 FROM posts WHERE posts.id = likes.post_id
  )
);

CREATE POLICY likes_insert ON likes FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM posts WHERE posts.id = post_id
  )
);

CREATE POLICY likes_delete ON likes FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- BOOKMARKS
-- Only own bookmarks visible
-- ============================================================

CREATE POLICY bookmarks_select ON bookmarks FOR SELECT USING (
  user_id = auth.uid()
);

CREATE POLICY bookmarks_insert ON bookmarks FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM posts WHERE posts.id = post_id
  )
);

CREATE POLICY bookmarks_delete ON bookmarks FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- FOLLOWS
-- Anyone can see follows (unless blocked)
-- ============================================================

CREATE POLICY follows_select ON follows FOR SELECT USING (
  NOT is_blocked(auth.uid(), follower_id)
  AND NOT is_blocked(auth.uid(), following_id)
);

CREATE POLICY follows_insert ON follows FOR INSERT WITH CHECK (
  follower_id = auth.uid()
  AND NOT is_blocked(auth.uid(), following_id)
);

CREATE POLICY follows_delete ON follows FOR DELETE USING (
  follower_id = auth.uid()
);

-- ============================================================
-- FOLLOW REQUESTS
-- Visible to requester and target
-- ============================================================

CREATE POLICY follow_requests_select ON follow_requests FOR SELECT USING (
  requester_id = auth.uid() OR target_id = auth.uid()
);

CREATE POLICY follow_requests_insert ON follow_requests FOR INSERT WITH CHECK (
  requester_id = auth.uid()
  AND NOT is_blocked(auth.uid(), target_id)
);

CREATE POLICY follow_requests_update ON follow_requests FOR UPDATE USING (
  target_id = auth.uid()
) WITH CHECK (
  target_id = auth.uid()
);

CREATE POLICY follow_requests_delete ON follow_requests FOR DELETE USING (
  requester_id = auth.uid() OR target_id = auth.uid()
);

-- ============================================================
-- BLOCKS
-- Only own blocks visible, only own blocks manageable
-- ============================================================

CREATE POLICY blocks_select ON blocks FOR SELECT USING (
  blocker_id = auth.uid()
);

CREATE POLICY blocks_insert ON blocks FOR INSERT WITH CHECK (
  blocker_id = auth.uid()
);

CREATE POLICY blocks_delete ON blocks FOR DELETE USING (
  blocker_id = auth.uid()
);

-- ============================================================
-- ROUTES
-- Published routes visible to all (unless blocked)
-- Own routes always visible
-- ============================================================

CREATE POLICY routes_select ON routes FOR SELECT USING (
  user_id = auth.uid()
  OR (
    is_published
    AND NOT is_blocked(auth.uid(), user_id)
  )
  OR is_curated  -- curated routes are always public
);

CREATE POLICY routes_insert ON routes FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY routes_update ON routes FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY routes_delete ON routes FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- ROUTE BOOKMARKS
-- Only own bookmarks
-- ============================================================

CREATE POLICY route_bookmarks_select ON route_bookmarks FOR SELECT USING (
  user_id = auth.uid()
);

CREATE POLICY route_bookmarks_insert ON route_bookmarks FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM routes WHERE routes.id = route_id
  )
);

CREATE POLICY route_bookmarks_delete ON route_bookmarks FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- RECORDINGS
-- Own recordings always visible
-- Non-hidden recordings visible to followers (unless blocked)
-- ============================================================

CREATE POLICY recordings_select ON recordings FOR SELECT USING (
  user_id = auth.uid()
  OR (
    NOT is_hidden
    AND NOT is_blocked(auth.uid(), user_id)
    AND (
      NOT (SELECT is_private FROM users WHERE id = recordings.user_id)
      OR is_following(auth.uid(), user_id)
    )
  )
);

CREATE POLICY recordings_insert ON recordings FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY recordings_update ON recordings FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY recordings_delete ON recordings FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- HIKING NETWORK
-- Public read for all authenticated users
-- ============================================================

CREATE POLICY hiking_network_select ON hiking_network FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- ============================================================
-- WEATHER FORECASTS
-- Public read for all authenticated users
-- ============================================================

CREATE POLICY weather_forecasts_select ON weather_forecasts FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- ============================================================
-- TRAIL CONDITIONS
-- Visible to all authenticated users (unless reporter is blocked)
-- ============================================================

CREATE POLICY trail_conditions_select ON trail_conditions FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND (user_id IS NULL OR NOT is_blocked(auth.uid(), user_id))
);

CREATE POLICY trail_conditions_insert ON trail_conditions FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY trail_conditions_update ON trail_conditions FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY trail_conditions_delete ON trail_conditions FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- GROUPS
-- Public groups visible to all
-- Private groups visible only to members
-- ============================================================

CREATE POLICY groups_select ON groups FOR SELECT USING (
  NOT is_private
  OR is_group_member(id, auth.uid())
  OR created_by = auth.uid()
);

CREATE POLICY groups_insert ON groups FOR INSERT WITH CHECK (
  created_by = auth.uid()
);

CREATE POLICY groups_update ON groups FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = groups.id AND user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY groups_delete ON groups FOR DELETE USING (
  created_by = auth.uid()
);

-- ============================================================
-- GROUP MEMBERS
-- Visible to other group members
-- ============================================================

CREATE POLICY group_members_select ON group_members FOR SELECT USING (
  is_group_member(group_id, auth.uid())
  AND NOT is_blocked(auth.uid(), user_id)
);

CREATE POLICY group_members_insert ON group_members FOR INSERT WITH CHECK (
  -- Self-join for public groups or admin adding members
  (user_id = auth.uid() AND NOT (SELECT is_private FROM groups WHERE id = group_id))
  OR EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role IN ('admin', 'moderator')
  )
);

CREATE POLICY group_members_update ON group_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
  )
);

CREATE POLICY group_members_delete ON group_members FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
  )
);

-- ============================================================
-- GROUP JOIN REQUESTS
-- Visible to the requester and group admins
-- ============================================================

CREATE POLICY group_join_requests_select ON group_join_requests FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = group_join_requests.group_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY group_join_requests_insert ON group_join_requests FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY group_join_requests_update ON group_join_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = group_join_requests.group_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY group_join_requests_delete ON group_join_requests FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- GROUP EVENTS
-- Visible to group members (and community members if linked)
-- ============================================================

CREATE POLICY group_events_select ON group_events FOR SELECT USING (
  is_group_member(group_id, auth.uid())
  OR (community_id IS NOT NULL AND is_community_member(community_id, auth.uid()))
  OR created_by = auth.uid()
);

CREATE POLICY group_events_insert ON group_events FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND is_group_member(group_id, auth.uid())
);

CREATE POLICY group_events_update ON group_events FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = group_events.group_id
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY group_events_delete ON group_events FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = group_events.group_id
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);

-- ============================================================
-- EVENT RESPONSES
-- Visible to group members
-- ============================================================

CREATE POLICY event_responses_select ON event_responses FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM group_events ge
    WHERE ge.id = event_responses.event_id
      AND is_group_member(ge.group_id, auth.uid())
  )
);

CREATE POLICY event_responses_insert ON event_responses FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM group_events ge
    WHERE ge.id = event_id
      AND is_group_member(ge.group_id, auth.uid())
  )
);

CREATE POLICY event_responses_update ON event_responses FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY event_responses_delete ON event_responses FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- COMMUNITIES
-- All communities are publicly visible
-- ============================================================

CREATE POLICY communities_select ON communities FOR SELECT USING (
  auth.uid() IS NOT NULL
);

CREATE POLICY communities_insert ON communities FOR INSERT WITH CHECK (
  created_by = auth.uid()
);

CREATE POLICY communities_update ON communities FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = communities.id AND user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY communities_delete ON communities FOR DELETE USING (
  created_by = auth.uid()
);

-- ============================================================
-- COMMUNITY MEMBERS
-- Visible to other community members
-- ============================================================

CREATE POLICY community_members_select ON community_members FOR SELECT USING (
  is_community_member(community_id, auth.uid())
  AND NOT is_blocked(auth.uid(), user_id)
);

CREATE POLICY community_members_insert ON community_members FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY community_members_update ON community_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM community_members cm
    WHERE cm.community_id = community_members.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
  )
);

CREATE POLICY community_members_delete ON community_members FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM community_members cm
    WHERE cm.community_id = community_members.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
  )
);

-- ============================================================
-- COMMUNITY JOIN REQUESTS
-- Visible to the requester and community admins
-- ============================================================

CREATE POLICY community_join_requests_select ON community_join_requests FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = community_join_requests.community_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY community_join_requests_insert ON community_join_requests FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY community_join_requests_update ON community_join_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = community_join_requests.community_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY community_join_requests_delete ON community_join_requests FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- DIRECT MESSAGES
-- Only sender and receiver, and only if mutual follow
-- ============================================================

CREATE POLICY direct_messages_select ON direct_messages FOR SELECT USING (
  (sender_id = auth.uid() OR receiver_id = auth.uid())
  AND NOT is_blocked(auth.uid(),
    CASE WHEN sender_id = auth.uid() THEN receiver_id ELSE sender_id END
  )
);

CREATE POLICY direct_messages_insert ON direct_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND NOT is_blocked(auth.uid(), receiver_id)
  AND is_mutual_follow(auth.uid(), receiver_id)
);

CREATE POLICY direct_messages_update ON direct_messages FOR UPDATE USING (
  -- Only receiver can mark as read
  receiver_id = auth.uid()
) WITH CHECK (
  receiver_id = auth.uid()
);

CREATE POLICY direct_messages_delete ON direct_messages FOR DELETE USING (
  sender_id = auth.uid()
);

-- ============================================================
-- POST MESSAGES
-- Only sender and receiver
-- ============================================================

CREATE POLICY post_messages_select ON post_messages FOR SELECT USING (
  (sender_id = auth.uid() OR receiver_id = auth.uid())
  AND NOT is_blocked(auth.uid(),
    CASE WHEN sender_id = auth.uid() THEN receiver_id ELSE sender_id END
  )
);

CREATE POLICY post_messages_insert ON post_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND NOT is_blocked(auth.uid(), receiver_id)
);

CREATE POLICY post_messages_update ON post_messages FOR UPDATE USING (
  receiver_id = auth.uid()
) WITH CHECK (
  receiver_id = auth.uid()
);

CREATE POLICY post_messages_delete ON post_messages FOR DELETE USING (
  sender_id = auth.uid()
);

-- ============================================================
-- REPORTS
-- Only own report or resolved_by
-- ============================================================

CREATE POLICY reports_select ON reports FOR SELECT USING (
  reporter_id = auth.uid()
  OR resolved_by = auth.uid()
);

CREATE POLICY reports_insert ON reports FOR INSERT WITH CHECK (
  reporter_id = auth.uid()
);

-- No update/delete for regular users (handled by service role / edge functions)

-- ============================================================
-- NOTIFICATIONS
-- Only own notifications
-- ============================================================

CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  user_id = auth.uid()
);

CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY notifications_delete ON notifications FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- BADGES
-- Public read for all authenticated users
-- ============================================================

CREATE POLICY badges_select ON badges FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- ============================================================
-- USER BADGES
-- Visible to all (unless blocked)
-- ============================================================

CREATE POLICY user_badges_select ON user_badges FOR SELECT USING (
  NOT is_blocked(auth.uid(), user_id)
);

-- Insert/delete managed by service role (edge functions trigger badge awards)

-- ============================================================
-- CHALLENGES
-- Public read for all authenticated users
-- ============================================================

CREATE POLICY challenges_select ON challenges FOR SELECT USING (
  auth.uid() IS NOT NULL
);

CREATE POLICY challenges_insert ON challenges FOR INSERT WITH CHECK (
  created_by = auth.uid()
);

CREATE POLICY challenges_update ON challenges FOR UPDATE USING (
  created_by = auth.uid()
) WITH CHECK (
  created_by = auth.uid()
);

-- ============================================================
-- CHALLENGE PARTICIPANTS
-- Visible to all authenticated users (leaderboard)
-- ============================================================

CREATE POLICY challenge_participants_select ON challenge_participants FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND NOT is_blocked(auth.uid(), user_id)
);

CREATE POLICY challenge_participants_insert ON challenge_participants FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY challenge_participants_update ON challenge_participants FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY challenge_participants_delete ON challenge_participants FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- HIGHLIGHT TOURS
-- Visible like recordings (follows profile visibility rules)
-- ============================================================

CREATE POLICY highlight_tours_select ON highlight_tours FOR SELECT USING (
  user_id = auth.uid()
  OR (
    NOT is_blocked(auth.uid(), user_id)
    AND (
      NOT (SELECT is_private FROM users WHERE id = highlight_tours.user_id)
      OR is_following(auth.uid(), user_id)
    )
  )
);

CREATE POLICY highlight_tours_insert ON highlight_tours FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY highlight_tours_update ON highlight_tours FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY highlight_tours_delete ON highlight_tours FOR DELETE USING (
  user_id = auth.uid()
);

-- ============================================================
-- LIVE TRACKING SESSIONS
-- Only own sessions or if user is in trusted_contacts
-- ============================================================

CREATE POLICY live_tracking_sessions_select ON live_tracking_sessions FOR SELECT USING (
  user_id = auth.uid()
  OR (
    is_active
    AND trusted_contacts ? auth.uid()::text
    AND NOT is_blocked(auth.uid(), user_id)
  )
);

CREATE POLICY live_tracking_sessions_insert ON live_tracking_sessions FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY live_tracking_sessions_update ON live_tracking_sessions FOR UPDATE USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY live_tracking_sessions_delete ON live_tracking_sessions FOR DELETE USING (
  user_id = auth.uid()
);
