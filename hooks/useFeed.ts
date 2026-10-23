import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import { calculateScore } from '../lib/feedAlgorithm';
import type { FeedPost } from '../types';

const PAGE_SIZE = 20;

type FeedPage = {
  posts: FeedPost[];
  hasMore: boolean;
  nextOffset: number;
};

// ─── DB row types (Supabase returns untyped data) ─────────
export interface PostRow {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: FeedPost['media_urls'];
  route_id: string | null;
  location: FeedPost['location'];
  group_id: string | null;
  community_id: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  is_hidden: boolean;
  user?: UserRow | null;
  route?: FeedPost['route'];
}

export interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  home_region?: string | null;
  is_private?: boolean;
}

export function useFeed() {
  const userId = useAuthStore((s) => s.user?.id);
  const userRegion = useAuthStore((s) => s.profile?.home_region);

  // ─── Main Feed ────────────────────────────────────────────
  const mainQuery = useInfiniteQuery({
    queryKey: queryKeys.feed.main(userId ?? ''),
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const offset = pageParam as number;

      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId!);

      const followingIds = followData?.map((f) => f.following_id) ?? [];

      const { data: blockedData } = await supabase
        .from('blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

      const blockedIds = new Set(
        (blockedData ?? []).map((b) =>
          b.blocker_id === userId ? b.blocked_id : b.blocker_id
        )
      );

      const allIds = [...followingIds, userId!].filter((id) => !blockedIds.has(id));

      if (allIds.length === 0) {
        return { posts: [], hasMore: false, nextOffset: offset + PAGE_SIZE };
      }

      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', allIds)
        // Gruppen- und Community-Beiträge stehen in ihren Detail-Screens
        .is('group_id', null)
        .is('community_id', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      const userIds = [...new Set((posts ?? []).map((p) => p.user_id))];
      const { data: usersData } = userIds.length > 0
        ? await supabase.from('users').select('id, username, display_name, avatar_url').in('id', userIds)
        : { data: [] as UserRow[] };
      const usersMap = Object.fromEntries((usersData ?? []).map((u: UserRow) => [u.id, u]));
      const postsWithUsers: PostRow[] = (posts ?? []).map((p) => ({ ...p, user: usersMap[p.user_id] ?? null }));

      const mapped = mapPosts(postsWithUsers);
      return {
        posts: mapped,
        hasMore: mapped.length === PAGE_SIZE,
        nextOffset: offset + PAGE_SIZE,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextOffset : undefined,
    enabled: !!userId,
  });

  // ─── Explore Feed ─────────────────────────────────────────
  const exploreQuery = useInfiniteQuery({
    retry: false,
    queryKey: queryKeys.feed.explore(userId ?? ''),
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const offset = pageParam as number;

      // Try the DB function first
      const { data, error } = await supabase.rpc('get_explore_feed', {
        p_user_id: userId!,
        p_user_region: userRegion ?? null,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });

      if (error) {
        // ─── Client-side fallback ──────────────────────────────────────────────
        // This fallback exists because the backend RPC `get_explore_feed`
        // is not always available (e.g. during development or when the
        // database function has not yet been deployed).
        // Scoring logic lives in `lib/feedAlgorithm.ts` (calculateScore).
        // TODO: Remove this fallback once the backend RPC is stable.
        const { data: blockedData } = await supabase
          .from('blocks')
          .select('blocked_id, blocker_id')
          .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

        const blockedIds = new Set(
          (blockedData ?? []).map((b) =>
            b.blocker_id === userId ? b.blocked_id : b.blocker_id
          )
        );

        const query = supabase
          .from('posts')
          .select(`
            *,
            user:users!posts_user_id_fkey(username, display_name, avatar_url, home_region, is_private)
          `)
          .is('group_id', null)
          .is('community_id', null)
          .eq('is_hidden', false)
          .neq('user_id', userId!)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        const { data: posts } = await query;

        const mapped = mapPosts(posts as PostRow[] | null)
          .filter((p) => !(p as FeedPost & { _is_private?: boolean })._is_private && !blockedIds.has(p.user_id))
          .map((p) => ({
            ...p,
            score: calculateScore(p, userRegion),
          }))
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        return {
          posts: mapped,
          hasMore: mapped.length === PAGE_SIZE,
          nextOffset: offset + PAGE_SIZE,
        };
      }

      const mapped: FeedPost[] = (data ?? []).map((row: PostRow & { username: string; display_name: string | null; avatar_url: string | null; score?: number }) => ({
        id: row.id,
        user_id: row.user_id,
        content: row.content,
        media_urls: row.media_urls,
        route_id: row.route_id,
        location: row.location,
        group_id: row.group_id,
        community_id: row.community_id,
        created_at: row.created_at,
        likes_count: row.likes_count,
        comments_count: row.comments_count,
        saves_count: row.saves_count,
        is_hidden: row.is_hidden,
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        score: row.score,
      }));

      return {
        posts: mapped,
        hasMore: mapped.length === PAGE_SIZE,
        nextOffset: offset + PAGE_SIZE,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextOffset : undefined,
    enabled: !!userId,
  });

  // ─── Derived values ───────────────────────────────────────
  const mainPosts = useMemo(
    () => mainQuery.data?.pages.flatMap((p: FeedPage) => p.posts) ?? [],
    [mainQuery.data],
  );
  const explorePosts = useMemo(
    () => exploreQuery.data?.pages.flatMap((p: FeedPage) => p.posts) ?? [],
    [exploreQuery.data],
  );
  const isLoadingMain = mainQuery.isLoading;
  const isLoadingExplore = exploreQuery.isLoading;
  const isRefreshing = mainQuery.isRefetching || exploreQuery.isRefetching;
  // hasNextPage is undefined before first fetch — default false so UI doesn't
  // show a "load more" spinner before any data has been fetched.
  const hasMoreMain = mainQuery.hasNextPage ?? false;
  const hasMoreExplore = exploreQuery.hasNextPage ?? false;

  // ─── Actions ──────────────────────────────────────────────
  const fetchMainFeed = (reset = false) => {
    if (reset) {
      mainQuery.refetch();
    } else {
      mainQuery.fetchNextPage();
    }
  };

  const fetchExploreFeed = (reset = false) => {
    if (reset) {
      exploreQuery.refetch();
    } else {
      exploreQuery.fetchNextPage();
    }
  };

  const refreshFeed = (tab: 'main' | 'explore') => {
    if (tab === 'main') {
      mainQuery.refetch();
    } else {
      exploreQuery.refetch();
    }
  };

  return {
    mainPosts,
    explorePosts,
    isLoadingMain,
    isLoadingExplore,
    isRefreshing,
    hasMoreMain,
    hasMoreExplore,
    fetchMainFeed,
    fetchExploreFeed,
    refreshFeed,
  };
}

// ─── Helpers ───────────────────────────────────────────────

export function mapPosts(data: PostRow[] | null): FeedPost[] {
  if (!data) return [];
  return data
    .filter((row) => !row.is_hidden)
    .map((row) => ({
      id: row.id,
      user_id: row.user_id,
      content: row.content,
      media_urls: row.media_urls,
      route_id: row.route_id,
      location: row.location,
      group_id: row.group_id,
      community_id: row.community_id,
      created_at: row.created_at,
      likes_count: row.likes_count ?? 0,
      comments_count: row.comments_count ?? 0,
      saves_count: row.saves_count ?? 0,
      is_hidden: row.is_hidden,
      username: row.user?.username ?? 'Unknown',
      display_name: row.user?.display_name ?? null,
      avatar_url: row.user?.avatar_url ?? null,
      _is_private: row.user?.is_private ?? false,
      _home_region: row.user?.home_region ?? undefined,
      route: row.route ?? null,
    })) as FeedPost[];
}

