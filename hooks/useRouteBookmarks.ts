import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import type { Route } from '../types';

export function useRouteBookmarks() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  // ─── Bookmarked route IDs ─────────────────────────────────
  const bookmarkedIdsQuery = useQuery({
    queryKey: queryKeys.posts.routeBookmarks(userId ?? ''),
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from('route_bookmarks')
        .select('route_id')
        .eq('user_id', userId!);
      return (data ?? []).map((d) => d.route_id);
    },
    enabled: !!userId,
  });

  // ─── Saved routes (disabled by default, fetched on demand) ─
  const savedRoutesQuery = useQuery({
    queryKey: queryKeys.posts.savedRoutes(userId ?? ''),
    queryFn: async (): Promise<Route[]> => {
      const { data, error } = await supabase
        .from('route_bookmarks')
        .select('route_id, routes(*)')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? [])
        .map((d: any) => d.routes as Route)
        .filter(Boolean);
    },
    enabled: false,
  });

  const bookmarkedIds = useMemo(
    () => new Set(bookmarkedIdsQuery.data ?? []),
    [bookmarkedIdsQuery.data],
  );

  const bookmarkedRoutes = savedRoutesQuery.data ?? [];
  const isLoading = savedRoutesQuery.isFetching;

  // ─── Toggle Bookmark Mutation ─────────────────────────────
  const toggleBookmarkMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const theKey = queryKeys.posts.routeBookmarks(userId ?? '');
      const prev = queryClient.getQueryData<string[]>(theKey) ?? [];
      const alreadyBookmarked = prev.includes(routeId);

      if (alreadyBookmarked) {
        const { error } = await supabase
          .from('route_bookmarks')
          .delete()
          .eq('user_id', userId!)
          .eq('route_id', routeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('route_bookmarks')
          .insert({ user_id: userId!, route_id: routeId });
        if (error) throw error;
      }
    },
    onMutate: async (routeId: string) => {
      const theKey = queryKeys.posts.routeBookmarks(userId ?? '');
      await queryClient.cancelQueries({ queryKey: theKey });
      const prev = queryClient.getQueryData<string[]>(theKey) ?? [];
      const isIn = prev.includes(routeId);
      queryClient.setQueryData<string[]>(
        theKey,
        isIn ? prev.filter((x) => x !== routeId) : [...prev, routeId],
      );
      return { prev, wasIn: isIn };
    },
    onError: (_err, _routeId, ctx) => {
      console.error('Bookmark toggle failed:', _err);
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.posts.routeBookmarks(userId ?? ''), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.routeBookmarks(userId ?? '') });
    },
  });

  // ─── Helpers ──────────────────────────────────────────────
  const isBookmarked = (routeId: string) => bookmarkedIds.has(routeId);

  const toggleBookmark = (routeId: string) => toggleBookmarkMutation.mutateAsync(routeId);

  const fetchBookmarkedRoutes = () => savedRoutesQuery.refetch();

  return {
    bookmarkedIds,
    bookmarkedRoutes,
    isLoading,
    isBookmarked,
    toggleBookmark,
    fetchBookmarkedRoutes,
  };
}
