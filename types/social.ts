// ─── Social Domain ─────────────────────────────────────────

import type { MediaItem, GeoPoint } from './common';
import type { SACScale } from './trail';

export interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: MediaItem[] | null;
  route_id: string | null;
  location: GeoPoint | null;
  group_id: string | null;
  community_id: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  is_hidden: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// ─── Likes & Bookmarks (Composite Keys) ────────────────────

export interface Like {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Bookmark {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface RouteBookmark {
  user_id: string;
  route_id: string;
  created_at: string;
}

// ─── Social: Follow, Block ─────────────────────────────────

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface FollowRequest {
  requester_id: string;
  target_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

// ─── Messaging ─────────────────────────────────────────────

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface PostMessage {
  id: string;
  post_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ─── Reports ───────────────────────────────────────────────

export type ReportReason = 'spam' | 'abuse' | 'fake' | 'inappropriate';

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  message_id: string | null;
  reason: ReportReason;
  description: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ─── Notifications ─────────────────────────────────────────

export type NotificationType =
  | 'follow'
  | 'like'
  | 'comment'
  | 'dm'
  | 'badge'
  | 'challenge'
  | 'group_invite'
  | 'event_reminder'
  | 'trail_condition'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ─── Highlight Tours ───────────────────────────────────────

export interface HighlightTour {
  id: string;
  user_id: string;
  recording_id: string;
  sort_order: number;
}

// ─── Groups ────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_private: boolean;
  invite_code: string | null;
  created_by: string | null;
  created_at: string;
}

export type GroupRole = 'admin' | 'moderator' | 'member';

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
}

export interface GroupJoinRequest {
  group_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

// ─── Group Events ──────────────────────────────────────────

export interface GroupEvent {
  id: string;
  group_id: string;
  community_id: string | null;
  title: string;
  description: string | null;
  event_date: string;
  meeting_point: string | null;
  meeting_location: GeoPoint | null;
  created_by: string | null;
  created_at: string;
}

export interface EventResponse {
  event_id: string;
  user_id: string;
  response: 'attending' | 'declined' | 'maybe';
  created_at: string;
}

// ─── Communities ────────────────────────────────────────────

export interface Community {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  region: string | null;
  is_official: boolean;
  created_by: string | null;
  created_at: string;
}

export type CommunityRole = 'admin' | 'moderator' | 'member';

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: CommunityRole;
  joined_at: string;
}

export interface CommunityJoinRequest {
  community_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

// ─── Feed Post (denormalized view model) ───────────────────
// Moved from stores/feedStore.ts – this is the shape returned by feed queries,
// combining post data with joined user and route fields.

export interface FeedPost {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: { url: string; type: 'image' | 'video'; width?: number; height?: number }[] | null;
  route_id: string | null;
  location: { latitude: number; longitude: number } | null;
  group_id: string | null;
  community_id: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  is_hidden?: boolean;
  // Joined user fields
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  // Explore score
  score?: number;
  // Joined route fields
  route?: {
    title: string;
    distance_m: number;
    elevation_gain_m: number | null;
    sac_scale: SACScale | null;
  } | null;
}
