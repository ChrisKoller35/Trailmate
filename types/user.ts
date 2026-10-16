// ─── User Domain ───────────────────────────────────────────

export type HikingLevel = 'T1-T2' | 'T3' | 'T4-T6';

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  bio: string | null;
  home_region: string | null;
  hiking_level: HikingLevel | null;
  is_premium: boolean;
  is_private: boolean;
  is_verified: boolean;
  notification_prefs: Record<string, unknown>;
  created_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  // Supabase Auth user; the e-mail lives here and in user_private, not in users
  user: User & { email?: string };
}

/** Own-row-only data (table user_private, migration 010). */
export interface UserPrivate {
  user_id: string;
  email: string | null;
  push_token: string | null;
  updated_at: string;
}
