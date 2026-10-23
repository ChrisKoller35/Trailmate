import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { LiveTrackingSession, GeoPoint } from '../types';

/** Antwort von get_live_tracking_by_token (Migration 021); null = Link nicht aktiv. */
export interface SharedLiveTracking {
  display_name: string;
  avatar_url: string | null;
  last_location: { longitude: number; latitude: number } | null;
  last_updated_at: string | null;
  expected_return: string | null;
  is_active: boolean;
  started_at: string;
}

export function useLiveTracking() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['live-tracking', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_tracking_sessions')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as LiveTrackingSession | null;
    },
  });
}

export function useStartLiveTracking() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      trusted_contacts: Array<{ name: string; phone?: string; email?: string }>;
      expected_return: string | null;
      update_interval_minutes: number;
    }) => {
      // share_token setzt der Server (Migration 021) und liefert es über .select() zurück.
      const { data, error } = await supabase
        .from('live_tracking_sessions')
        .insert({
          user_id: userId!,
          trusted_contacts: params.trusted_contacts,
          expected_return: params.expected_return,
          update_interval_minutes: params.update_interval_minutes,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as LiveTrackingSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-tracking', userId] });
    },
  });
}

export function useStopLiveTracking() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('live_tracking_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-tracking', userId] });
    },
  });
}

export function useUpdateTrackingLocation() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { sessionId: string; location: GeoPoint }) => {
      const pointWkt = `SRID=4326;POINT(${params.location.longitude} ${params.location.latitude})`;

      const { error } = await supabase
        .from('live_tracking_sessions')
        .update({
          last_location: pointWkt as any,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', params.sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-tracking', userId] });
    },
  });
}

export function useLiveTrackingByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['live-tracking-token', token],
    enabled: !!token,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_live_tracking_by_token', {
        p_token: token!,
      });

      if (error) throw error;
      return (data as SharedLiveTracking | null) ?? null;
    },
  });
}
