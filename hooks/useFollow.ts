import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import { showErrorToast } from '../lib/toast';
import type { FollowRequest } from '../types';

type FollowStatus = 'following' | 'requested' | 'none';

export function useFollow() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  // ─── Follow Requests Query ────────────────────────────────
  const followRequestsQuery = useQuery({
    queryKey: queryKeys.follow.requests(userId ?? ''),
    queryFn: async (): Promise<FollowRequest[]> => {
      const { data } = await supabase
        .from('follow_requests')
        .select('*')
        .eq('target_id', userId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return (data ?? []) as FollowRequest[];
    },
    enabled: !!userId,
  });

  const followRequests = followRequestsQuery.data ?? [];
  const followRequestCount = followRequests.length;

  // ─── Mutations ────────────────────────────────────────────
  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      // Private Profile sind für Nicht-Follower unsichtbar (users_select).
      // Keine Zeile heisst darum: privat, also Anfrage statt direkt folgen.
      const { data: targetUser } = await supabase
        .from('users')
        .select('is_private')
        .eq('id', targetUserId)
        .maybeSingle();

      if (!targetUser || targetUser.is_private) {
        const { error } = await supabase
          .from('follow_requests')
          .insert({ requester_id: userId!, target_id: targetUserId, status: 'pending' });
        // 23505: Anfrage läuft schon, das gilt als Erfolg.
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: userId!, following_id: targetUserId });
        if (error) throw error;
      }
    },
    onError: () => {
      showErrorToast('Folgen fehlgeschlagen.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.follow.requests(userId ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.main(userId ?? '') });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId!)
        .eq('following_id', targetUserId);

      if (error) throw error;

      await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', userId!)
        .eq('target_id', targetUserId);
    },
    onError: () => {
      showErrorToast('Entfolgen fehlgeschlagen.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.follow.requests(userId ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.main(userId ?? '') });
    },
  });

  const removeFollowerMutation = useMutation({
    mutationFn: async (followerId: string) => {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', userId!);

      if (error) throw error;
    },
    onError: () => {
      showErrorToast('Follower konnte nicht entfernt werden.');
    },
  });

  const acceptFollowRequestMutation = useMutation({
    mutationFn: async (requesterId: string) => {
      const { error: updateError } = await supabase
        .from('follow_requests')
        .update({ status: 'accepted' })
        .eq('requester_id', requesterId)
        .eq('target_id', userId!)
        .eq('status', 'pending');

      if (updateError) {
        console.error('Accept follow request failed:', updateError);
        throw updateError;
      }
      // Die Folge legt der Server beim Annehmen an (Trigger aus Migration 018).
    },
    onMutate: async (requesterId: string) => {
      const theKey = queryKeys.follow.requests(userId ?? '');
      await queryClient.cancelQueries({ queryKey: theKey });
      const prev = queryClient.getQueryData<FollowRequest[]>(theKey) ?? [];
      queryClient.setQueryData<FollowRequest[]>(
        theKey,
        prev.filter((r) => r.requester_id !== requesterId),
      );
      return { prev };
    },
    onError: (_err, _requesterId, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.follow.requests(userId ?? ''), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.follow.requests(userId ?? '') });
    },
  });

  const rejectFollowRequestMutation = useMutation({
    mutationFn: async (requesterId: string) => {
      // Löschen statt 'rejected', damit später eine neue Anfrage möglich ist.
      const { error } = await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', requesterId)
        .eq('target_id', userId!)
        .eq('status', 'pending');

      if (error) {
        console.error('Reject follow request failed:', error);
        throw error;
      }
    },
    onMutate: async (requesterId: string) => {
      const theKey = queryKeys.follow.requests(userId ?? '');
      await queryClient.cancelQueries({ queryKey: theKey });
      const prev = queryClient.getQueryData<FollowRequest[]>(theKey) ?? [];
      queryClient.setQueryData<FollowRequest[]>(
        theKey,
        prev.filter((r) => r.requester_id !== requesterId),
      );
      return { prev };
    },
    onError: (_err, _requesterId, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.follow.requests(userId ?? ''), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.follow.requests(userId ?? '') });
    },
  });

  // ─── Imperative async helpers ─────────────────────────────
  const getFollowRequests = async (): Promise<FollowRequest[]> => {
    const result = await followRequestsQuery.refetch();
    return result.data ?? [];
  };

  const getFollowStatus = async (targetUserId: string): Promise<FollowStatus> => {
    if (!userId) return 'none';

    const { data: followData } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', userId)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (followData) return 'following';

    const { data: requestData } = await supabase
      .from('follow_requests')
      .select('status')
      .eq('requester_id', userId)
      .eq('target_id', targetUserId)
      .eq('status', 'pending')
      .maybeSingle();

    if (requestData) return 'requested';

    return 'none';
  };

  const isMutualFollow = async (otherUserId: string): Promise<boolean> => {
    if (!userId) return false;

    const { data } = await supabase.rpc('check_mutual_follow', {
      user1: userId,
      user2: otherUserId,
    });

    return data === true;
  };

  // ─── mutateAsync wrappers ─────────────────────────────────
  const follow = (targetUserId: string) => followMutation.mutateAsync(targetUserId);
  const unfollow = (targetUserId: string) => unfollowMutation.mutateAsync(targetUserId);
  const removeFollower = (followerId: string) => removeFollowerMutation.mutateAsync(followerId);
  const acceptFollowRequest = (requesterId: string) => acceptFollowRequestMutation.mutateAsync(requesterId);
  const rejectFollowRequest = (requesterId: string) => rejectFollowRequestMutation.mutateAsync(requesterId);

  return {
    follow,
    unfollow,
    removeFollower,
    acceptFollowRequest,
    rejectFollowRequest,
    isMutualFollow,
    getFollowRequests,
    getFollowStatus,
    followRequestCount,
    followRequests,
  };
}
