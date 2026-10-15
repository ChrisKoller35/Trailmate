// ─── Gamification Domain ───────────────────────────────────

export interface Badge {
  id: string;
  name: string | null;
  description: string | null;
  icon_url: string | null;
  category: string | null;
  rarity: 'normal' | 'rare' | 'epic' | null;
}

export interface UserBadge {
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  goal: Record<string, unknown> | null;
  start_date: string | null;
  end_date: string | null;
  badge_id: string | null;
  region: string | null;
  created_by: string | null;
  is_sponsored: boolean;
  created_at: string;
}

export interface ChallengeParticipant {
  challenge_id: string;
  user_id: string;
  progress: number;
  completed_at: string | null;
  joined_at: string;
}
