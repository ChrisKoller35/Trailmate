import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type StatsPeriod = 'week' | 'month' | 'season' | 'year' | 'all';

function getDateRange(period: StatsPeriod): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;

  switch (period) {
    case 'week':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      break;
    case 'season': {
      // Current hiking season: April–October or previous if off-season
      const month = now.getMonth();
      const year = now.getFullYear();
      if (month >= 3 && month <= 9) {
        start = new Date(year, 3, 1);
      } else if (month < 3) {
        start = new Date(year - 1, 3, 1);
      } else {
        start = new Date(year, 3, 1);
      }
      break;
    }
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
      start = new Date(2020, 0, 1);
      break;
  }

  return { start: start.toISOString(), end };
}

export function useStats(userId: string | undefined, period: StatsPeriod) {
  const { start, end } = getDateRange(period);

  return useQuery({
    queryKey: ['user-stats', userId, period],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_stats', {
        p_user_id: userId!,
        p_start_date: start,
        p_end_date: end,
      });

      if (error) throw error;
      return data as {
        total_tours: number;
        total_distance_m: number;
        total_elevation_gain_m: number;
        total_duration_seconds: number;
        total_steps: number;
        avg_distance_m: number;
        avg_elevation_gain_m: number;
      };
    },
  });
}

export function useMonthlyActivity(userId: string | undefined, year: number) {
  return useQuery({
    queryKey: ['monthly-activity', userId, year],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_activity', {
        p_user_id: userId!,
        p_year: year,
      });

      if (error) throw error;
      return data as Array<{
        month: number;
        tours: number;
        distance_m: number;
        elevation_gain_m: number;
      }>;
    },
  });
}

export function usePersonalRecords(userId: string | undefined) {
  return useQuery({
    queryKey: ['personal-records', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_personal_records', {
        p_user_id: userId!,
      });

      if (error) throw error;
      return data as {
        longest_tour_km: number;
        highest_elevation_m: number;
        longest_duration_h: number;
        most_steps: number;
        fastest_avg_speed: number;
      };
    },
  });
}

export function useYearComparison(userId: string | undefined) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;

  const dayOfYear = Math.floor(
    (now.getTime() - new Date(thisYear, 0, 1).getTime()) / 86_400_000
  );

  const thisStart = new Date(thisYear, 0, 1).toISOString();
  const thisEnd = now.toISOString();
  const lastStart = new Date(lastYear, 0, 1).toISOString();
  const lastEnd = new Date(lastYear, 0, 1 + dayOfYear).toISOString();

  return useQuery({
    queryKey: ['year-comparison', userId, thisYear],
    enabled: !!userId,
    queryFn: async () => {
      const [thisYearRes, lastYearRes] = await Promise.all([
        supabase.rpc('get_user_stats', {
          p_user_id: userId!,
          p_start_date: thisStart,
          p_end_date: thisEnd,
        }),
        supabase.rpc('get_user_stats', {
          p_user_id: userId!,
          p_start_date: lastStart,
          p_end_date: lastEnd,
        }),
      ]);

      if (thisYearRes.error) throw thisYearRes.error;
      if (lastYearRes.error) throw lastYearRes.error;

      const curr = thisYearRes.data as { total_tours: number; total_distance_m: number; total_elevation_gain_m: number; total_duration_seconds: number };
      const prev = lastYearRes.data as typeof curr;

      const pct = (c: number, p: number) => (p === 0 ? (c > 0 ? 100 : 0) : Math.round(((c - p) / p) * 100));

      return {
        thisYear: curr,
        lastYear: prev,
        toursDiff: pct(curr.total_tours, prev.total_tours),
        distanceDiff: pct(curr.total_distance_m, prev.total_distance_m),
        elevationDiff: pct(curr.total_elevation_gain_m, prev.total_elevation_gain_m),
        durationDiff: pct(curr.total_duration_seconds, prev.total_duration_seconds),
      };
    },
  });
}
