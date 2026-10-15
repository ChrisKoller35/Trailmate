/**
 * Feed scoring algorithm for the Explore feed.
 *
 * This file contains the pure scoring logic, decoupled from database access
 * and React hooks, so it can be tested independently.
 */

/** Minimal post type required for scoring. */
export interface ScoredPost {
  created_at: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  /** Home region of the post author – populated from the user object during mapping. */
  _home_region?: string;
}

/**
 * Calculates a relevance score for a feed post.
 *
 * Factors:
 * - Engagement: likes × 2 + comments × 3 + saves × 4
 * - Recency decay: score decreases as the post ages (half-life ~20h)
 * - Region boost: posts from the user's home region receive a factor of 1.5
 *
 * @param post - Post object with engagement counters and optional home region
 * @param userRegion - Home region of the logged-in user (may be null/undefined)
 * @returns Numeric score; higher value = more relevant
 */
export function calculateScore(
  post: ScoredPost,
  userRegion: string | null | undefined,
): number {
  const ageHours =
    (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
  const engagement =
    post.likes_count * 2 + post.comments_count * 3 + post.saves_count * 4;
  const recencyDecay = 1.0 / (1.0 + ageHours * 0.05);
  const regionBoost =
    userRegion && post._home_region === userRegion ? 1.5 : 1.0;
  return engagement * recencyDecay * regionBoost;
}
