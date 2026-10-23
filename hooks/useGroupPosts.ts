import { useCallback, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { mapPosts, type PostRow, type UserRow } from './useFeed';
import type { FeedPost } from '../types';

const PAGE_SIZE = 20;

export type GroupPostsTarget = { type: 'group' | 'community'; id: string };

type GroupPostsPage = {
  posts: FeedPost[];
  hasMore: boolean;
  nextOffset: number;
};

// Unter 'feed', damit deletePost in usePostActions die Liste mit auffrischt
export const groupPostsKey = (target: GroupPostsTarget) =>
  ['feed', target.type, target.id] as const;

/** Eine Seite Beiträge einer Gruppe bzw. Community, neueste zuerst. */
export async function fetchGroupPosts(
  target: GroupPostsTarget,
  offset: number,
): Promise<GroupPostsPage> {
  const column = target.type === 'group' ? 'group_id' : 'community_id';
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .eq(column, target.id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;

  const userIds = [...new Set((posts ?? []).map((p) => p.user_id))];
  const { data: usersData } = userIds.length > 0
    ? await supabase.from('users').select('id, username, display_name, avatar_url').in('id', userIds)
    : { data: [] as UserRow[] };
  const usersMap = Object.fromEntries((usersData ?? []).map((u: UserRow) => [u.id, u]));
  const postsWithUsers: PostRow[] = (posts ?? []).map((p) => ({ ...p, user: usersMap[p.user_id] ?? null }));

  return {
    posts: mapPosts(postsWithUsers),
    hasMore: (posts ?? []).length === PAGE_SIZE,
    nextOffset: offset + PAGE_SIZE,
  };
}

export function useGroupPosts(target: GroupPostsTarget) {
  const userId = useAuthStore((s) => s.user?.id);

  const query = useInfiniteQuery({
    queryKey: groupPostsKey(target),
    queryFn: ({ pageParam }) => fetchGroupPosts(target, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage: GroupPostsPage) => lastPage.hasMore ? lastPage.nextOffset : undefined,
    enabled: !!userId && !!target.id,
  });

  const posts = useMemo(
    () => query.data?.pages.flatMap((p: GroupPostsPage) => p.posts) ?? [],
    [query.data],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const refresh = useCallback(() => { refetch(); }, [refetch]);

  return {
    posts,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching && !isFetchingNextPage,
    isError: query.isError,
    hasMore: hasNextPage ?? false,
    loadMore,
    refresh,
  };
}
