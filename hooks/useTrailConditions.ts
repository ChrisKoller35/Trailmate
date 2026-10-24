import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import { uploadTrailConditionPhoto } from '../lib/storage';
import { showErrorToast } from '../lib/toast';
import type { TrailCondition } from '../types';

// ─── Types ─────────────────────────────────────────────────

export interface ConditionReportData {
  conditions: string[];
  snow_line_meters?: number;
  comment?: string;
  photoUri?: string;
}

export interface TrailConditionWithUser extends TrailCondition {
  user?: {
    username: string;
    avatar_url: string | null;
  };
}

/** own: eigener Bericht (nur Zahl), voted: schon gestimmt, open: tippbar */
export type UpvoteState = 'own' | 'voted' | 'open';

export function getUpvoteState(
  report: Pick<TrailCondition, 'id' | 'user_id'>,
  userId: string | undefined,
  votedIds: ReadonlySet<string>,
): UpvoteState {
  if (userId && report.user_id === userId) return 'own';
  if (votedIds.has(report.id)) return 'voted';
  return 'open';
}

interface UseTrailConditionsReturn {
  conditions: TrailConditionWithUser[];
  recentConditions: TrailConditionWithUser[];
  outdatedConditions: TrailConditionWithUser[];
  isLoading: boolean;
  error: string | null;
  submitReport: (data: ConditionReportData) => Promise<void>;
  upvote: (conditionId: string) => void;
  /** IDs der Berichte, für die die eigene Stimme schon gezählt ist */
  votedIds: ReadonlySet<string>;
  /** Bericht, dessen Stimme gerade gesendet wird */
  upvotingId: string | null;
  userId: string | undefined;
  hasUserReported: boolean;
  refreshConditions: () => void;
}

// ─── Constants ─────────────────────────────────────────────

const OUTDATED_THRESHOLD_DAYS = 14;

// ─── Hook ──────────────────────────────────────────────────

export function useTrailConditions(routeId: string): UseTrailConditionsReturn {
  const profile = useAuthStore((state) => state.profile);
  const userId = profile?.id;
  const queryClient = useQueryClient();

  // ─── Conditions query ────────────────────────────────────
  const conditionsQuery = useQuery({
    queryKey: queryKeys.trailConditions(routeId),
    queryFn: async (): Promise<TrailConditionWithUser[]> => {
      const { data, error: fetchError } = await supabase
        .from('trail_conditions')
        .select(`
          *,
          user:users!trail_conditions_user_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq('route_id', routeId)
        .order('reported_at', { ascending: false });

      if (fetchError) throw fetchError;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        route_id: row.route_id,
        user_id: row.user_id,
        reported_at: row.reported_at,
        conditions: row.conditions,
        snow_line_meters: row.snow_line_meters,
        comment: row.comment,
        photo_urls: row.photo_urls,
        location: row.location,
        helpfulness_score: row.helpfulness_score ?? 0,
        expires_at: row.expires_at,
        user: row.user
          ? {
              username: row.user.username,
              avatar_url: row.user.avatar_url,
            }
          : undefined,
      }));
    },
    enabled: !!routeId,
  });

  const conditions = useMemo(() => conditionsQuery.data ?? [], [conditionsQuery.data]);
  const conditionIds = useMemo(() => conditions.map((c) => c.id), [conditions]);

  // ─── Own votes query ─────────────────────────────────────
  // Key liegt unter trailConditions(routeId), damit dieselbe Invalidierung
  // Berichte und Stimmen neu lädt.
  const votesQuery = useQuery({
    queryKey: [...queryKeys.trailConditions(routeId), 'votes', userId, conditionIds],
    queryFn: async (): Promise<string[]> => {
      const { data, error: fetchError } = await supabase
        .from('trail_condition_votes')
        .select('condition_id')
        .eq('user_id', userId ?? '')
        .in('condition_id', conditionIds);

      if (fetchError) throw fetchError;
      return (data ?? []).map((row: { condition_id: string }) => row.condition_id);
    },
    enabled: !!userId && conditionIds.length > 0,
  });

  const votedIds = useMemo(() => new Set(votesQuery.data ?? []), [votesQuery.data]);
  const isLoading = conditionsQuery.isLoading;
  const error = conditionsQuery.error instanceof Error ? conditionsQuery.error.message : null;

  const refreshConditions = useCallback(
    () => { conditionsQuery.refetch(); },
    [conditionsQuery],
  );

  // ─── Split recent vs outdated ────────────────────────────
  const { recentConditions, outdatedConditions } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - OUTDATED_THRESHOLD_DAYS);
    const cutoffISO = cutoff.toISOString();

    const recent: TrailConditionWithUser[] = [];
    const outdated: TrailConditionWithUser[] = [];

    for (const c of conditions) {
      if (c.reported_at >= cutoffISO) {
        recent.push(c);
      } else {
        outdated.push(c);
      }
    }

    return { recentConditions: recent, outdatedConditions: outdated };
  }, [conditions]);

  // ─── Check if current user already reported ──────────────
  const hasUserReported = useMemo(() => {
    if (!userId) return false;
    return conditions.some((c) => c.user_id === userId);
  }, [conditions, userId]);

  // ─── Submit report mutation ──────────────────────────────
  const submitReportMutation = useMutation({
    mutationFn: async (data: ConditionReportData) => {
      if (!userId) throw new Error('Nicht angemeldet');
      if (!routeId) throw new Error('Keine Route ausgewählt');

      // Build conditions JSONB object
      const conditionsObj: Record<string, boolean> = {
        trail_open: data.conditions.includes('trail_open'),
        snow_fields: data.conditions.includes('snow_fields'),
        wet_slippery: data.conditions.includes('wet_slippery'),
        rockfall_danger: data.conditions.includes('rockfall_danger'),
        partially_closed: data.conditions.includes('partially_closed'),
        bridge_damaged: data.conditions.includes('bridge_damaged'),
      };

      // Set expiry to 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const insertData: Record<string, unknown> = {
        route_id: routeId,
        user_id: userId,
        conditions: conditionsObj,
        snow_line_meters: data.snow_line_meters ?? null,
        comment: data.comment?.trim() || null,
        photo_urls: [],
        helpfulness_score: 0,
        expires_at: expiresAt.toISOString(),
      };

      const { data: inserted, error: insertError } = await supabase
        .from('trail_conditions')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload photo if provided
      if (data.photoUri && inserted) {
        const photoResults = await uploadTrailConditionPhoto(inserted.id, [
          {
            uri: data.photoUri,
            name: `condition_${Date.now()}.jpg`,
            type: 'image/jpeg',
          },
        ]);

        const photoUrls = photoResults.map((r) => r.publicUrl);

        const { error: updateError } = await supabase
          .from('trail_conditions')
          .update({ photo_urls: photoUrls })
          .eq('id', inserted.id);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trailConditions(routeId) });
    },
  });

  const submitReport = useCallback(
    (data: ConditionReportData) => submitReportMutation.mutateAsync(data),
    [submitReportMutation],
  );

  // ─── Upvote mutation ─────────────────────────────────────
  const upvoteMutation = useMutation({
    mutationFn: async (conditionId: string) => {
      // Login, Doppelstimmen und eigene Berichte prüft die Datenbank (022).
      const { error: rpcError } = await supabase.rpc(
        'upvote_trail_condition',
        { p_condition_id: conditionId },
      );

      if (rpcError) throw rpcError;
    },
    onError: () => {
      showErrorToast('Stimme konnte nicht gezählt werden.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trailConditions(routeId) });
    },
  });

  const upvote = useCallback(
    (conditionId: string) => upvoteMutation.mutate(conditionId),
    [upvoteMutation],
  );

  const upvotingId = upvoteMutation.isPending ? upvoteMutation.variables ?? null : null;

  return {
    conditions,
    recentConditions,
    outdatedConditions,
    isLoading,
    error,
    submitReport,
    upvote,
    votedIds,
    upvotingId,
    userId,
    hasUserReported,
    refreshConditions,
  };
}
