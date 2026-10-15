-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgrouting";

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) UNIQUE NOT NULL,
    display_name VARCHAR(50),
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    cover_image_url TEXT,
    bio TEXT,
    home_region VARCHAR(100),
    hiking_level VARCHAR(10),
    is_premium BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    notification_prefs JSONB DEFAULT '{}',
    push_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    media_urls JSONB,
    route_id UUID,  -- forward ref to routes
    location GEOMETRY(Point, 4326),
    group_id UUID,  -- forward ref to groups
    community_id UUID, -- forward ref to communities
    created_at TIMESTAMPTZ DEFAULT NOW(),
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0
);

-- Comments
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes
CREATE TABLE likes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

-- Bookmarks
CREATE TABLE bookmarks (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

-- Follows
CREATE TABLE follows (
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- Follow requests (private profiles)
CREATE TABLE follow_requests (
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (requester_id, target_id)
);

-- Blocks
CREATE TABLE blocks (
    blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);

-- Routes
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(200),
    description TEXT,
    gpx_url TEXT,
    geom GEOMETRY(LineString, 4326),
    distance_m FLOAT,
    elevation_gain_m FLOAT,
    elevation_loss_m FLOAT,
    max_elevation_m FLOAT,
    estimated_duration_min INTEGER,
    sac_scale VARCHAR(2),
    is_published BOOLEAN DEFAULT FALSE,
    is_curated BOOLEAN DEFAULT FALSE,
    region VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route bookmarks
CREATE TABLE route_bookmarks (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, route_id)
);

-- Add FK from posts to routes
ALTER TABLE posts ADD CONSTRAINT fk_posts_route FOREIGN KEY (route_id) REFERENCES routes(id);

-- Recordings
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id),
    title VARCHAR(200),
    gpx_url TEXT,
    geom GEOMETRY(LineString, 4326),
    distance_m FLOAT,
    elevation_gain_m FLOAT,
    elevation_loss_m FLOAT,
    duration_seconds INTEGER,
    moving_time_seconds INTEGER,
    avg_speed_kmh FLOAT,
    steps INTEGER,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    is_hidden BOOLEAN DEFAULT FALSE
);

-- Hiking network (pgRouting)
CREATE TABLE hiking_network (
    id SERIAL PRIMARY KEY,
    geom GEOMETRY(LineString, 4326),
    source INTEGER,
    target INTEGER,
    length_m FLOAT,
    elevation_gain FLOAT,
    elevation_loss FLOAT,
    sac_scale VARCHAR(2),
    surface VARCHAR(50),
    cost FLOAT
);

-- Weather forecasts
CREATE TABLE weather_forecasts (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(20),
    location GEOMETRY(Point, 4326),
    station_elevation_m FLOAT,
    forecast_time TIMESTAMPTZ,
    temperature FLOAT,
    precipitation FLOAT,
    wind_speed FLOAT,
    cloud_cover FLOAT,
    weather_symbol_code VARCHAR(10),
    source VARCHAR(20) DEFAULT 'meteoswiss',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_location ON weather_forecasts USING GIST(location);
CREATE INDEX idx_weather_forecast_time ON weather_forecasts(forecast_time);

-- Trail conditions
CREATE TABLE trail_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id),
    user_id UUID REFERENCES users(id),
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    conditions JSONB,
    snow_line_meters INTEGER,
    comment TEXT,
    photo_urls TEXT[],
    location GEOMETRY(Point, 4326),
    helpfulness_score INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ
);

-- Groups
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    invite_code VARCHAR(20) UNIQUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from posts to groups
ALTER TABLE posts ADD CONSTRAINT fk_posts_group FOREIGN KEY (group_id) REFERENCES groups(id);

-- Group members
CREATE TABLE group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- Group join requests
CREATE TABLE group_join_requests (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- Group events
CREATE TABLE group_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    community_id UUID,  -- forward ref
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    meeting_point TEXT,
    meeting_location GEOMETRY(Point, 4326),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event responses
CREATE TABLE event_responses (
    event_id UUID REFERENCES group_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    response VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- Communities
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    category VARCHAR(50),
    region VARCHAR(100),
    is_official BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from posts to communities
ALTER TABLE posts ADD CONSTRAINT fk_posts_community FOREIGN KEY (community_id) REFERENCES communities(id);
-- Add FK from group_events to communities
ALTER TABLE group_events ADD CONSTRAINT fk_events_community FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE;

-- Community members
CREATE TABLE community_members (
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);

-- Community join requests
CREATE TABLE community_join_requests (
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);

-- Direct messages
CREATE TABLE direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post messages
CREATE TABLE post_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES users(id),
    post_id UUID REFERENCES posts(id),
    comment_id UUID REFERENCES comments(id),
    message_id UUID,
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title TEXT,
    body TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges definitions
CREATE TABLE badges (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    description TEXT,
    icon_url TEXT,
    category VARCHAR(50),
    rarity VARCHAR(20)
);

-- User badges
CREATE TABLE user_badges (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    badge_id VARCHAR(50) REFERENCES badges(id),
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

-- Challenges
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(20),
    goal JSONB,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    badge_id VARCHAR(50) REFERENCES badges(id),
    region VARCHAR(100),
    created_by UUID REFERENCES users(id),
    is_sponsored BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Challenge participants
CREATE TABLE challenge_participants (
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    progress FLOAT DEFAULT 0,
    completed_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (challenge_id, user_id)
);

-- Highlight tours
CREATE TABLE highlight_tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(user_id, recording_id)
);

-- Live tracking sessions 
CREATE TABLE live_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    share_token VARCHAR(50) UNIQUE NOT NULL,
    trusted_contacts JSONB,
    expected_return TIMESTAMPTZ,
    update_interval_minutes INTEGER DEFAULT 10,
    last_location GEOMETRY(Point, 4326),
    last_updated_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT NOW()
);

-- Additional useful indexes
CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_group ON posts(group_id);
CREATE INDEX idx_posts_community ON posts(community_id);
CREATE INDEX idx_posts_location ON posts USING GIST(location);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_recordings_user ON recordings(user_id);
CREATE INDEX idx_routes_region ON routes(region);
CREATE INDEX idx_routes_geom ON routes USING GIST(geom);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_dm_sender ON direct_messages(sender_id);
CREATE INDEX idx_dm_receiver ON direct_messages(receiver_id);
CREATE INDEX idx_trail_conditions_route ON trail_conditions(route_id);
CREATE INDEX idx_hiking_network_geom ON hiking_network USING GIST(geom);
