import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import type { Group, GroupMember, GroupJoinRequest, GroupRole } from '../types';

export function useGroups() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  // ─── My groups query ─────────────────────────────────────
  const myGroupsQuery = useQuery({
    queryKey: queryKeys.groups.mine(userId ?? ''),
    queryFn: async (): Promise<(Group & { role: GroupRole })[]> => {
      if (!userId) return [];

      const { data } = await supabase
        .from('group_members')
        .select('role, group:groups(*)')
        .eq('user_id', userId);

      if (!data) return [];

      return data
        .filter((d: any) => d.group)
        .map((d: any) => ({ ...d.group, role: d.role }));
    },
    enabled: !!userId,
  });

  const myGroups = myGroupsQuery.data ?? [];

  const fetchMyGroups = useCallback(
    () => myGroupsQuery.refetch(),
    [myGroupsQuery],
  );

  // ─── Create group mutation ───────────────────────────────
  const createGroupMutation = useMutation({
    mutationFn: async ({
      name,
      description,
      isPrivate,
      coverImageUrl,
    }: {
      name: string;
      description: string;
      isPrivate: boolean;
      coverImageUrl?: string;
    }): Promise<Group | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('groups')
        .insert({
          name,
          description,
          is_private: isPrivate,
          cover_image_url: coverImageUrl ?? null,
          created_by: userId,
          invite_code: isPrivate ? generateCode() : null,
        })
        .select()
        .single();

      if (error) {
        console.error('Gruppe erstellen fehlgeschlagen:', error);
        return null;
      }

      // Add creator as admin
      await supabase
        .from('group_members')
        .insert({ group_id: data.id, user_id: userId, role: 'admin' });

      return data as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine(userId!) });
    },
  });

  const createGroup = useCallback(
    (name: string, description: string, isPrivate: boolean, coverImageUrl?: string) =>
      createGroupMutation.mutateAsync({ name, description, isPrivate, coverImageUrl }),
    [createGroupMutation],
  );

  // ─── Search groups (not cached) ──────────────────────────
  const searchGroups = useCallback(
    async (query: string): Promise<Group[]> => {
      const { data } = await supabase
        .from('groups')
        .select('*')
        .eq('is_private', false)
        .ilike('name', `%${query}%`)
        .limit(20);

      return (data ?? []) as Group[];
    },
    [],
  );

  // ─── Get group detail (imperative) ──────────────────────
  const getGroupDetail = useCallback(
    async (groupId: string) => {
      const [groupRes, membersRes, eventsRes] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).single(),
        supabase
          .from('group_members')
          .select('*, user:users(username, display_name, avatar_url)')
          .eq('group_id', groupId),
        supabase
          .from('group_events')
          .select('*')
          .eq('group_id', groupId)
          .gte('event_date', new Date().toISOString())
          .order('event_date', { ascending: true }),
      ]);

      return {
        group: groupRes.data as Group | null,
        members: (membersRes.data ?? []) as (GroupMember & { user: any })[],
        events: eventsRes.data ?? [],
      };
    },
    [],
  );

  // ─── Join group mutation ─────────────────────────────────
  const joinGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!userId) throw new Error('Not authenticated');

      // Check if group is private
      const { data: group } = await supabase
        .from('groups')
        .select('is_private')
        .eq('id', groupId)
        .single();

      if (group?.is_private) {
        // Submit join request
        const { error } = await supabase
          .from('group_join_requests')
          .insert({ group_id: groupId, user_id: userId, status: 'pending' });
        if (error) {
          console.error('Beitrittsanfrage fehlgeschlagen:', error);
          throw error;
        }
      } else {
        // Join directly
        const { error } = await supabase
          .from('group_members')
          .insert({ group_id: groupId, user_id: userId, role: 'member' });
        if (error) {
          console.error('Beitritt fehlgeschlagen:', error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine(userId!) });
    },
  });

  const joinGroup = useCallback(
    (groupId: string) => joinGroupMutation.mutateAsync(groupId),
    [joinGroupMutation],
  );

  // ─── Join by invite code mutation ────────────────────────
  const joinByInviteCodeMutation = useMutation({
    mutationFn: async (code: string): Promise<boolean> => {
      if (!userId) return false;

      const { data: group } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', code)
        .single();

      if (!group) return false;

      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: userId, role: 'member' });

      if (error) {
        console.error('Beitritt per Code fehlgeschlagen:', error);
        return false;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine(userId!) });
    },
  });

  const joinByInviteCode = useCallback(
    (code: string) => joinByInviteCodeMutation.mutateAsync(code),
    [joinByInviteCodeMutation],
  );

  // ─── Leave group mutation ────────────────────────────────
  const leaveGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) {
        console.error('Gruppe verlassen fehlgeschlagen:', error);
        throw error;
      }
    },
    onMutate: async (groupId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.groups.mine(userId!) });
      const prev = queryClient.getQueryData<(Group & { role: GroupRole })[]>(
        queryKeys.groups.mine(userId!),
      );
      queryClient.setQueryData<(Group & { role: GroupRole })[]>(
        queryKeys.groups.mine(userId!),
        (old) => (old ?? []).filter((g) => g.id !== groupId),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.groups.mine(userId!), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine(userId!) });
    },
  });

  const leaveGroup = useCallback(
    (groupId: string) => leaveGroupMutation.mutateAsync(groupId),
    [leaveGroupMutation],
  );

  // ─── Add member (admin/mod) ──────────────────────────────
  const addMember = useCallback(
    async (groupId: string, targetUserId: string) => {
      if (!userId) return;

      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: targetUserId, role: 'member' });

      if (error) console.error('Add member failed:', error);
      else queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
    },
    [userId, queryClient],
  );

  // ─── Remove member (admin/mod) ───────────────────────────
  const removeMember = useCallback(
    async (groupId: string, targetUserId: string) => {
      if (!userId) return;

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (error) console.error('Remove member failed:', error);
      else queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
    },
    [userId, queryClient],
  );

  // ─── Update member role (admin only) ────────────────────
  const updateMemberRole = useCallback(
    async (groupId: string, targetUserId: string, role: GroupRole) => {
      if (!userId) return;

      const { error } = await supabase
        .from('group_members')
        .update({ role })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId);

      if (error) console.error('Update member role failed:', error);
      else queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
    },
    [userId, queryClient],
  );

  // ─── Delete group mutation ───────────────────────────────
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!userId) throw new Error('Not authenticated');

      // Remove events and responses first
      const { data: events } = await supabase
        .from('group_events')
        .select('id')
        .eq('group_id', groupId);
      if (events?.length) {
        const eventIds = events.map((e: any) => e.id);
        await supabase.from('event_responses').delete().in('event_id', eventIds);
        await supabase.from('group_events').delete().eq('group_id', groupId);
      }

      // Remove group posts
      await supabase.from('posts').delete().eq('group_id', groupId);

      // Remove members and requests
      await supabase.from('group_members').delete().eq('group_id', groupId);
      await supabase.from('group_join_requests').delete().eq('group_id', groupId);

      const { error } = await supabase.from('groups').delete().eq('id', groupId);

      if (error) {
        console.error('Delete group failed:', error);
        throw error;
      }
    },
    onMutate: async (groupId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.groups.mine(userId!) });
      const prev = queryClient.getQueryData<(Group & { role: GroupRole })[]>(
        queryKeys.groups.mine(userId!),
      );
      queryClient.setQueryData<(Group & { role: GroupRole })[]>(
        queryKeys.groups.mine(userId!),
        (old) => (old ?? []).filter((g) => g.id !== groupId),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.groups.mine(userId!), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine(userId!) });
    },
  });

  const deleteGroup = useCallback(
    (groupId: string) => deleteGroupMutation.mutateAsync(groupId),
    [deleteGroupMutation],
  );

  // ─── Join requests (admin/mod) ───────────────────────────
  const getJoinRequests = useCallback(
    async (groupId: string): Promise<GroupJoinRequest[]> => {
      const { data } = await supabase
        .from('group_join_requests')
        .select('*, user:users(username, display_name, avatar_url)')
        .eq('group_id', groupId)
        .eq('status', 'pending');

      return (data ?? []) as GroupJoinRequest[];
    },
    [],
  );

  const approveJoinRequest = useCallback(
    async (groupId: string, targetUserId: string) => {
      if (!userId) return;

      await supabase
        .from('group_join_requests')
        .update({ status: 'accepted' })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)
        .eq('status', 'pending');

      await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: targetUserId, role: 'member' });

      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.mine(userId) });
    },
    [userId, queryClient],
  );

  const rejectJoinRequest = useCallback(
    async (groupId: string, targetUserId: string) => {
      if (!userId) return;

      await supabase
        .from('group_join_requests')
        .update({ status: 'rejected' })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)
        .eq('status', 'pending');

      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
    },
    [userId, queryClient],
  );

  // ─── Generate invite code (admin) ────────────────────────
  const generateInviteCode = useCallback(
    async (groupId: string): Promise<string | null> => {
      if (!userId) return null;

      const code = generateCode();
      const { error } = await supabase
        .from('groups')
        .update({ invite_code: code })
        .eq('id', groupId);

      if (error) {
        console.error('Code generieren fehlgeschlagen:', error);
        return null;
      }
      return code;
    },
    [userId],
  );

  // ─── Get own role in group ───────────────────────────────
  const getGroupRole = useCallback(
    async (groupId: string): Promise<GroupRole | null> => {
      if (!userId) return null;

      const { data } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

      return (data?.role as GroupRole) ?? null;
    },
    [userId],
  );

  return {
    createGroup,
    myGroups,
    fetchMyGroups,
    searchGroups,
    getGroupDetail,
    joinGroup,
    joinByInviteCode,
    leaveGroup,
    addMember,
    removeMember,
    updateMemberRole,
    deleteGroup,
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    generateInviteCode,
    getGroupRole,
  };
}

// ─── Generate random 8-character invite code ───────────────
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint8Array(8);
  globalThis.crypto.getRandomValues(array);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(array[i] % chars.length);
  }
  return code;
}
