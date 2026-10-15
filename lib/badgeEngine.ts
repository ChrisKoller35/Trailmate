import { supabase } from './supabase';

interface BadgeCondition {
  badgeId: string;
  check: (ctx: BadgeContext) => boolean;
}

/** All data required for badge evaluation. Exported for use in unit tests. */
export interface BadgeContext {
  totalDistanceM: number;
  totalElevationM: number;
  totalRecordings: number;
  recordingsThisYear: number;
  maxDurationSeconds: number;
  hasEarlyStart: boolean;
  hasConsecutive7Days: boolean;
  hasPost: boolean;
  isEarlyAdopter: boolean;
  hasWinterHike: boolean;
  trailReports: number;
}

const BADGE_CONDITIONS: BadgeCondition[] = [
  // Distance milestones
  { badgeId: '100km_total', check: (ctx) => ctx.totalDistanceM >= 100_000 },
  { badgeId: '500km_total', check: (ctx) => ctx.totalDistanceM >= 500_000 },
  { badgeId: '1000km_total', check: (ctx) => ctx.totalDistanceM >= 1_000_000 },
  // Elevation milestones
  { badgeId: '5000hm_total', check: (ctx) => ctx.totalElevationM >= 5_000 },
  { badgeId: '10000hm_total', check: (ctx) => ctx.totalElevationM >= 10_000 },
  { badgeId: '50000hm_total', check: (ctx) => ctx.totalElevationM >= 50_000 },
  // Tour count
  { badgeId: '10_tours', check: (ctx) => ctx.totalRecordings >= 10 },
  { badgeId: '50_tours', check: (ctx) => ctx.totalRecordings >= 50 },
  { badgeId: '100_tours', check: (ctx) => ctx.totalRecordings >= 100 },
  // Single tour duration
  { badgeId: 'tour_6h', check: (ctx) => ctx.maxDurationSeconds >= 21_600 },
  { badgeId: 'tour_10h', check: (ctx) => ctx.maxDurationSeconds >= 36_000 },
  // Time-based
  { badgeId: 'early_bird', check: (ctx) => ctx.hasEarlyStart },
  { badgeId: '7_day_streak', check: (ctx) => ctx.hasConsecutive7Days },
  { badgeId: '30_tours_year', check: (ctx) => ctx.recordingsThisYear >= 30 },
  // Weather / Seasons
  { badgeId: 'winter_hike', check: (ctx) => ctx.hasWinterHike },
  // Social
  { badgeId: 'first_post', check: (ctx) => ctx.hasPost },
  // Trail reporting
  { badgeId: 'trail_reporter_5', check: (ctx) => ctx.trailReports >= 5 },
  { badgeId: 'trail_reporter_25', check: (ctx) => ctx.trailReports >= 25 },
  // Special
  { badgeId: 'early_adopter', check: (ctx) => ctx.isEarlyAdopter },
];

export function hasConsecutiveDays(dates: string[], days: number): boolean {
  if (dates.length < days) return false;

  const uniqueDays = [...new Set(
    dates.map((d) => {
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    })
  )].sort();

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1] + 'T00:00:00');
    const curr = new Date(uniqueDays[i] + 'T00:00:00');
    const diffMs = curr.getTime() - prev.getTime();
    if (diffMs === 86_400_000) {
      streak++;
      if (streak >= days) return true;
    } else if (diffMs > 86_400_000) {
      streak = 1;
    }
  }
  return streak >= days;
}

/**
 * Pure function: evaluates all badge conditions against a BadgeContext and
 * returns the IDs of all satisfied badges. No Supabase calls.
 * Exported so it can be tested in isolation in unit tests.
 */
export function evaluateConditions(ctx: BadgeContext): string[] {
  return BADGE_CONDITIONS
    .filter((condition) => condition.check(ctx))
    .map((condition) => condition.badgeId);
}

export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  // Query 1: Aggregate recording stats + individual recording data
  const { data: recordings } = await supabase
    .from('recordings')
    .select('distance_m, elevation_gain_m, duration_seconds, started_at')
    .eq('user_id', userId)
    .eq('is_hidden', false);

  // Query 2: Already earned badges
  const { data: earnedBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);

  // Query 3: Social + early adopter + trail reports checks
  const [postsResult, userRankResult, trailReportsResult] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('users').select('id').order('created_at', { ascending: true }).limit(1000),
    supabase.from('trail_conditions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const recs = recordings ?? [];
  const earnedIds = new Set((earnedBadges ?? []).map((b) => b.badge_id));

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const totalDistanceM = recs.reduce((sum, r) => sum + (r.distance_m ?? 0), 0);
  const totalElevationM = recs.reduce((sum, r) => sum + (r.elevation_gain_m ?? 0), 0);
  const maxDurationSeconds = recs.reduce((max, r) => Math.max(max, r.duration_seconds ?? 0), 0);
  const recordingsThisYear = recs.filter(
    (r) => r.started_at && r.started_at >= yearStart
  ).length;

  const hasEarlyStart = recs.some((r) => {
    if (!r.started_at) return false;
    const hour = new Date(r.started_at).getHours();
    return hour < 7;
  });

  const startDates = recs
    .map((r) => r.started_at)
    .filter((d): d is string => d != null);

  const hasConsecutive7Days = hasConsecutiveDays(startDates, 7);
  const hasPost = (postsResult.count ?? 0) > 0;
  const earlyAdopterIds = new Set((userRankResult.data ?? []).map((u) => u.id));
  const isEarlyAdopter = earlyAdopterIds.has(userId);

  const hasWinterHike = recs.some((r) => {
    if (!r.started_at) return false;
    const month = new Date(r.started_at).getMonth();
    return month === 11 || month === 0 || month === 1; // Dec, Jan, Feb
  });

  const trailReports = trailReportsResult.count ?? 0;

  const ctx: BadgeContext = {
    totalDistanceM,
    totalElevationM,
    totalRecordings: recs.length,
    recordingsThisYear,
    maxDurationSeconds,
    hasEarlyStart,
    hasConsecutive7Days,
    hasPost,
    isEarlyAdopter,
    hasWinterHike,
    trailReports,
  };

  const newlyAwarded: string[] = [];

  for (const condition of BADGE_CONDITIONS) {
    if (earnedIds.has(condition.badgeId)) continue;
    if (!condition.check(ctx)) continue;

    const { data } = await supabase.rpc('award_badge', {
      p_user_id: userId,
      p_badge_id: condition.badgeId,
    });

    if (data) {
      newlyAwarded.push(condition.badgeId);
    }
  }

  return newlyAwarded;
}

/**
 * Update progress for all active challenges the user has joined.
 * Called after each tour recording save.
 */
export async function updateChallengeProgress(
  userId: string,
  tourStats: { distance: number; elevationGain: number; duration: number }
): Promise<void> {
  // Get user's active challenge participations
  const { data: participations } = await supabase
    .from('challenge_participants')
    .select('challenge_id, progress, challenges(type, goal)')
    .eq('user_id', userId)
    .is('completed_at', null);

  if (!participations || participations.length === 0) return;

  // Get total stats for the user (for cumulative challenges)
  const { data: recordings } = await supabase
    .from('recordings')
    .select('distance_m, elevation_gain_m')
    .eq('user_id', userId)
    .eq('is_hidden', false);

  const totalKm = (recordings ?? []).reduce((sum, r) => sum + (r.distance_m ?? 0), 0) / 1000;
  const totalElevation = (recordings ?? []).reduce((sum, r) => sum + (r.elevation_gain_m ?? 0), 0);
  const totalTours = (recordings ?? []).length;

  for (const p of participations) {
    const challenge = (p as any).challenges;
    if (!challenge) continue;

    let newProgress = p.progress;

    switch (challenge.type) {
      case 'distance':
        newProgress = totalKm;
        break;
      case 'elevation':
        newProgress = totalElevation;
        break;
      case 'tours':
        newProgress = totalTours;
        break;
      default:
        continue;
    }

    if (newProgress > p.progress) {
      await supabase.rpc('update_challenge_progress', {
        p_user_id: userId,
        p_challenge_id: p.challenge_id,
        p_progress: newProgress,
      });
    }
  }
}
