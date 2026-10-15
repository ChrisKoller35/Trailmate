import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import type { Community, CommunityMember, CommunityJoinRequest, CommunityRole } from '../types';

interface CommunityFilters {
  region?: string;
  category?: string;
  query?: string;
}

export function useCommunities() {
  const userId = useAuthStore((s) => s.user?.id);
  const userRegion = useAuthStore((s) => s.profile?.home_region);
  const queryClient = useQueryClient();

  // ─── My communities query ────────────────────────────────
  const myCommunitiesQuery = useQuery({
    queryKey: queryKeys.communities.mine(userId ?? ''),
    queryFn: async (): Promise<(Community & { role: CommunityRole })[]> => {
      if (!userId) return [];

      const { data } = await supabase
        .from('community_members')
        .select('role, community:communities(*)')
        .eq('user_id', userId);

      if (!data) return [];

      return data
        .filter((d: any) => d.community)
        .map((d: any) => ({ ...d.community, role: d.role }));
    },
    enabled: !!userId,
  });

  const myCommunities = myCommunitiesQuery.data ?? [];

  const fetchMyCommunities = useCallback(
    () => myCommunitiesQuery.refetch(),
    [myCommunitiesQuery],
  );

  // ─── Suggested communities query ────────────────────────
  const suggestedQuery = useQuery({
    queryKey: queryKeys.communities.suggested(userId ?? ''),
    queryFn: async (): Promise<Community[]> => {
      if (!userId) return [];

      let query = supabase
        .from('communities')
        .select('*')
        .limit(10);

      if (userRegion) {
        query = query.eq('region', userRegion);
      }

      const { data } = await query;

      // Filter out already joined communities
      const myIds = new Set((myCommunitiesQuery.data ?? []).map((c) => c.id));
      return ((data ?? []) as Community[]).filter((c) => !myIds.has(c.id));
    },
    enabled: !!userId && myCommunitiesQuery.isSuccess,
  });

  const suggestedCommunities = suggestedQuery.data ?? [];

  const fetchSuggested = useCallback(
    () => suggestedQuery.refetch(),
    [suggestedQuery],
  );

  // ─── Discover communities (search, not cached) ──────────
  const discoverCommunities = useCallback(
    async (filters?: CommunityFilters): Promise<Community[]> => {
      let query = supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (filters?.region) {
        query = query.eq('region', filters.region);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.query) {
        query = query.ilike('name', `%${filters.query}%`);
      }

      const { data } = await query;
      return (data ?? []) as Community[];
    },
    [],
  );

  // ─── Get community detail (imperative) ──────────────────
  const getCommunityDetail = useCallback(
    async (communityId: string) => {
      const [communityRes, membersRes] = await Promise.all([
        supabase.from('communities').select('*').eq('id', communityId).single(),
        supabase
          .from('community_members')
          .select('*, user:users(username, display_name, avatar_url)')
          .eq('community_id', communityId),
      ]);

      return {
        community: communityRes.data as Community | null,
        members: (membersRes.data ?? []) as (CommunityMember & { user: any })[],
      };
    },
    [],
  );

  // ─── Request to join mutation ────────────────────────────
  const requestToJoinMutation = useMutation({
    mutationFn: async (communityId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('community_join_requests')
        .insert({ community_id: communityId, user_id: userId, status: 'pending' });

      if (error) {
        console.error('Beitrittsanfrage fehlgeschlagen:', error);
        throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine(userId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.suggested(userId!) });
    },
  });

  const requestToJoin = useCallback(
    (communityId: string) => requestToJoinMutation.mutateAsync(communityId),
    [requestToJoinMutation],
  );

  // ─── Leave community mutation ────────────────────────────
  const leaveCommunityMutation = useMutation({
    mutationFn: async (communityId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', userId);

      if (error) {
        console.error('Community verlassen fehlgeschlagen:', error);
        throw error;
      }
    },
    onMutate: async (communityId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.communities.mine(userId!) });
      const prev = queryClient.getQueryData<(Community & { role: CommunityRole })[]>(
        queryKeys.communities.mine(userId!),
      );
      queryClient.setQueryData<(Community & { role: CommunityRole })[]>(
        queryKeys.communities.mine(userId!),
        (old) => (old ?? []).filter((c) => c.id !== communityId),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.communities.mine(userId!), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine(userId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.suggested(userId!) });
    },
  });

  const leaveCommunity = useCallback(
    (communityId: string) => leaveCommunityMutation.mutateAsync(communityId),
    [leaveCommunityMutation],
  );

  // ─── Create community mutation ───────────────────────────
  const createCommunityMutation = useMutation({
    mutationFn: async ({
      name,
      description,
      category,
      region,
      coverUrl,
    }: {
      name: string;
      description: string;
      category: string;
      region: string;
      coverUrl?: string;
    }): Promise<Community | null> => {
      if (!userId) return null;

      // Check verification
      const { data: profile } = await supabase
        .from('users')
        .select('is_verified')
        .eq('id', userId)
        .single();

      if (!profile?.is_verified) {
        console.error('Only verified users can create communities');
        return null;
      }

      const { data, error } = await supabase
        .from('communities')
        .insert({
          name,
          description,
          category,
          region,
          cover_image_url: coverUrl ?? null,
          created_by: userId,
          is_official: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Community erstellen fehlgeschlagen:', error);
        return null;
      }

      // Add creator as admin
      await supabase
        .from('community_members')
        .insert({ community_id: data.id, user_id: userId, role: 'admin' });

      return data as Community;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine(userId!) });
    },
  });

  const createCommunity = useCallback(
    (name: string, description: string, category: string, region: string, coverUrl?: string) =>
      createCommunityMutation.mutateAsync({ name, description, category, region, coverUrl }),
    [createCommunityMutation],
  );

  // ─── Manage community (admin functions) ─────────────────
  const manageCommunity = useMemo(
    () => ({
      addMember: async (communityId: string, targetUserId: string) => {
        if (!userId) return;
        await supabase
          .from('community_members')
          .insert({ community_id: communityId, user_id: targetUserId, role: 'member' });
        queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine(userId!) });
      },

      removeMember: async (communityId: string, targetUserId: string) => {
        if (!userId) return;
        await supabase
          .from('community_members')
          .delete()
          .eq('community_id', communityId)
          .eq('user_id', targetUserId);
        queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine(userId!) });
      },

      updateMemberRole: async (communityId: string, targetUserId: string, role: CommunityRole) => {
        if (!userId) return;
        await supabase
          .from('community_members')
          .update({ role })
          .eq('community_id', communityId)
          .eq('user_id', targetUserId);
        queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine(userId!) });
      },

      getJoinRequests: async (communityId: string): Promise<CommunityJoinRequest[]> => {
        const { data } = await supabase
          .from('community_join_requests')
          .select('*, user:users(username, display_name, avatar_url)')
          .eq('community_id', communityId)
          .eq('status', 'pending');
        return (data ?? []) as CommunityJoinRequest[];
      },

      approveJoinRequest: async (communityId: string, targetUserId: string) => {
        if (!userId) return;
        await supabase
          .from('community_join_requests')
          .update({ status: 'accepted' })
          .eq('community_id', communityId)
          .eq('user_id', targetUserId)
          .eq('status', 'pending');

        await supabase
          .from('community_members')
          .insert({ community_id: communityId, user_id: targetUserId, role: 'member' });

        queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine(userId!) });
      },

      rejectJoinRequest: async (communityId: string, targetUserId: string) => {
        if (!userId) return;
        await supabase
          .from('community_join_requests')
          .update({ status: 'rejected' })
          .eq('community_id', communityId)
          .eq('user_id', targetUserId)
          .eq('status', 'pending');
      },

      deleteCommunity: async (communityId: string) => {
        if (!userId) return;
        await supabase.from('community_members').delete().eq('community_id', communityId);
        await supabase.from('community_join_requests').delete().eq('community_id', communityId);
        await supabase.from('communities').delete().eq('id', communityId);
        queryClient.invalidateQueries({ queryKey: queryKeys.communities.mine(userId!) });
        queryClient.invalidateQueries({ queryKey: queryKeys.communities.suggested(userId!) });
      },
    }),
    [userId, queryClient],
  );

  // ─── Get community role (imperative) ────────────────────
  const getCommunityRole = useCallback(
    async (communityId: string): Promise<CommunityRole | null> => {
      if (!userId) return null;

      const { data } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .maybeSingle();

      return (data?.role as CommunityRole) ?? null;
    },
    [userId],
  );

  return {
    discoverCommunities,
    suggestedCommunities,
    fetchSuggested,
    myCommunities,
    getCommunityDetail,
    requestToJoin,
    leaveCommunity,
    createCommunity,
    manageCommunity,
    getCommunityRole,
    fetchMyCommunities,
  };
}
