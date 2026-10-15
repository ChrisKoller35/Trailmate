import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import { showErrorToast } from '../lib/toast';
import type { Block } from '../types';

export function useBlock() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  // ─── Blocks Query ─────────────────────────────────────────
  const blocksQuery = useQuery({
    queryKey: queryKeys.blocks(userId ?? ''),
    queryFn: async (): Promise<Block[]> => {
      const { data } = await supabase
        .from('blocks')
        .select('*')
        .eq('blocker_id', userId!)
        .order('created_at', { ascending: false });
      return (data ?? []) as Block[];
    },
    enabled: !!userId,
  });

  const blockedUsers = blocksQuery.data ?? [];

  const blockedIds = useMemo(
    () => new Set((blocksQuery.data ?? []).map((b) => b.blocked_id)),
    [blocksQuery.data],
  );

  // ─── Block Mutation ───────────────────────────────────────
  const blockUserMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error: blockError } = await supabase
        .from('blocks')
        .insert({ blocker_id: userId!, blocked_id: targetUserId });

      if (blockError) throw blockError;

      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId!)
        .eq('following_id', targetUserId);

      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', targetUserId)
        .eq('following_id', userId!);

      await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', userId!)
        .eq('target_id', targetUserId);

      await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', targetUserId)
        .eq('target_id', userId!);
    },
    onMutate: async (targetUserId: string) => {
      const theKey = queryKeys.blocks(userId ?? '');
      await queryClient.cancelQueries({ queryKey: theKey });
      const prev = queryClient.getQueryData<Block[]>(theKey) ?? [];
      const newBlock: Block = {
        blocker_id: userId!,
        blocked_id: targetUserId,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<Block[]>(theKey, [newBlock, ...prev]);
      return { prev };
    },
    onError: (_err, _targetUserId, ctx) => {
      showErrorToast('Nutzer konnte nicht blockiert werden.');
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.blocks(userId ?? ''), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks(userId ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.main(userId ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.explore(userId ?? '') });
    },
  });

  // ─── Unblock Mutation ─────────────────────────────────────
  const unblockUserMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', userId!)
        .eq('blocked_id', targetUserId);

      if (error) throw error;
    },
    onMutate: async (targetUserId: string) => {
      const theKey = queryKeys.blocks(userId ?? '');
      await queryClient.cancelQueries({ queryKey: theKey });
      const prev = queryClient.getQueryData<Block[]>(theKey) ?? [];
      queryClient.setQueryData<Block[]>(
        theKey,
        prev.filter((b) => b.blocked_id !== targetUserId),
      );
      return { prev };
    },
    onError: (_err, _targetUserId, ctx) => {
      showErrorToast('Nutzer konnte nicht entblockiert werden.');
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.blocks(userId ?? ''), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blocks(userId ?? '') });
    },
  });

  // ─── Helpers ──────────────────────────────────────────────
  const getBlockedUsers = (): Promise<Block[]> =>
    blocksQuery.refetch().then((r) => r.data ?? []);

  const isBlocked = (targetUserId: string): boolean => blockedIds.has(targetUserId);

  const blockUser = (targetUserId: string) => blockUserMutation.mutateAsync(targetUserId);
  const unblockUser = (targetUserId: string) => unblockUserMutation.mutateAsync(targetUserId);

  return {
    blockUser,
    unblockUser,
    isBlocked,
    getBlockedUsers,
    blockedIds,
    blockedUsers,
  };
}
