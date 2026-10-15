import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Badge, UserBadge } from '../types';

export interface BadgeWithStatus extends Badge {
  earned: boolean;
  earned_at: string | null;
}

export function useBadges(userId: string | undefined) {
  return useQuery({
    queryKey: ['badges-all', userId],
    enabled: !!userId,
    queryFn: async (): Promise<BadgeWithStatus[]> => {
      const [badgesRes, earnedRes] = await Promise.all([
        supabase.from('badges').select('*').order('category'),
        supabase
          .from('user_badges')
          .select('badge_id, earned_at')
          .eq('user_id', userId!),
      ]);

      const badges = badgesRes.data ?? [];
      const earnedMap = new Map(
        (earnedRes.data ?? []).map((ub) => [ub.badge_id, ub.earned_at])
      );

      return badges.map((b) => ({
        ...b,
        earned: earnedMap.has(b.id),
        earned_at: earnedMap.get(b.id) ?? null,
      }));
    },
  });
}

export function useUserBadges(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-badges', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('*, badge:badges(*)')
        .eq('user_id', userId!)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data as (UserBadge & { badge: Badge })[];
    },
  });
}
