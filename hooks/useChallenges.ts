import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Challenge, ChallengeParticipant } from '../types';

export function useChallenges() {
  return useQuery({
    queryKey: ['challenges-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .gte('end_date', new Date().toISOString())
        .order('end_date', { ascending: true });

      if (error) throw error;
      return data as Challenge[];
    },
  });
}

export function useChallenge(challengeId: string | undefined) {
  return useQuery({
    queryKey: ['challenge', challengeId],
    enabled: !!challengeId,
    queryFn: async () => {
      const [challengeRes, countRes] = await Promise.all([
        supabase
          .from('challenges')
          .select('*')
          .eq('id', challengeId!)
          .single(),
        supabase
          .from('challenge_participants')
          .select('user_id', { count: 'exact', head: true })
          .eq('challenge_id', challengeId!),
      ]);

      if (challengeRes.error) throw challengeRes.error;

      return {
        challenge: challengeRes.data as Challenge,
        participantCount: countRes.count ?? 0,
      };
    },
  });
}

export function useChallengeParticipation(
  challengeId: string | undefined,
  userId: string | undefined
) {
  return useQuery({
    queryKey: ['challenge-participation', challengeId, userId],
    enabled: !!challengeId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenge_participants')
        .select('*')
        .eq('challenge_id', challengeId!)
        .eq('user_id', userId!)
        .maybeSingle();

      if (error) throw error;
      return data as ChallengeParticipant | null;
    },
  });
}

export function useJoinChallenge() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('challenge_participants')
        .insert({
          challenge_id: challengeId,
          user_id: userId,
          progress: 0,
        });

      if (error) throw error;
    },
    onSuccess: (_data, challengeId) => {
      queryClient.invalidateQueries({ queryKey: ['challenge-participation', challengeId, userId] });
      queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] });
      queryClient.invalidateQueries({ queryKey: ['challenges-active'] });
    },
  });
}

export function useLeaderboard(challengeId: string | undefined) {
  return useQuery({
    queryKey: ['challenge-leaderboard', challengeId],
    enabled: !!challengeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_challenge_leaderboard', {
        p_challenge_id: challengeId!,
        p_limit: 20,
      });

      if (error) throw error;
      return data as Array<{
        user_id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        progress: number;
        rank: number;
      }>;
    },
  });
}
