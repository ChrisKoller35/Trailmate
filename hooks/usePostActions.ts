import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import type { Comment } from '../types';

export function usePostActions() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  // ─── Liked post IDs ───────────────────────────────────────
  const likedIdsQuery = useQuery({
    queryKey: queryKeys.posts.likes(userId ?? ''),
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', userId!);
      return (data ?? []).map((d) => d.post_id);
    },
    enabled: !!userId,
  });

  // ─── Bookmarked post IDs ──────────────────────────────────
  const bookmarkedIdsQuery = useQuery({
    queryKey: queryKeys.posts.bookmarks(userId ?? ''),
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from('bookmarks')
        .select('post_id')
        .eq('user_id', userId!);
      return (data ?? []).map((d) => d.post_id);
    },
    enabled: !!userId,
  });

  const likedIds = useMemo(
    () => new Set(likedIdsQuery.data ?? []),
    [likedIdsQuery.data],
  );

  const bookmarkedIds = useMemo(
    () => new Set(bookmarkedIdsQuery.data ?? []),
    [bookmarkedIdsQuery.data],
  );

  // ─── Like Toggle Mutation ─────────────────────────────────
  const toggleLikeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const theKey = queryKeys.posts.likes(userId!);
      const prev = queryClient.getQueryData<string[]>(theKey) ?? [];
      const alreadyLiked = prev.includes(postId);
      if (alreadyLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', userId!)
          .eq('post_id', postId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: userId!, post_id: postId });
        if (error) throw error;
      }
    },
    onMutate: async (postId: string) => {
      const theKey = queryKeys.posts.likes(userId!);
      await queryClient.cancelQueries({ queryKey: theKey });
      const prev = queryClient.getQueryData<string[]>(theKey) ?? [];
      const isIn = prev.includes(postId);
      queryClient.setQueryData<string[]>(
        theKey,
        isIn ? prev.filter((x) => x !== postId) : [...prev, postId],
      );
      return { prev, wasIn: isIn };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.posts.likes(userId!), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.likes(userId!) });
    },
  });

  // ─── Bookmark Toggle Mutation ─────────────────────────────
  const toggleBookmarkMutation = useMutation({
    mutationFn: async (postId: string) => {
      const theKey = queryKeys.posts.bookmarks(userId!);
      const prev = queryClient.getQueryData<string[]>(theKey) ?? [];
      const alreadyBookmarked = prev.includes(postId);
      if (alreadyBookmarked) {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', userId!)
          .eq('post_id', postId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bookmarks')
          .insert({ user_id: userId!, post_id: postId });
        if (error) throw error;
      }
    },
    onMutate: async (postId: string) => {
      const theKey = queryKeys.posts.bookmarks(userId!);
      await queryClient.cancelQueries({ queryKey: theKey });
      const prev = queryClient.getQueryData<string[]>(theKey) ?? [];
      const isIn = prev.includes(postId);
      queryClient.setQueryData<string[]>(
        theKey,
        isIn ? prev.filter((x) => x !== postId) : [...prev, postId],
      );
      return { prev, wasIn: isIn };
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.posts.bookmarks(userId!), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.bookmarks(userId!) });
    },
  });

  // ─── Comment Mutations ────────────────────────────────────
  const addCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: userId!,
          content: content.trim(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(variables.postId) });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ commentId, postId: _postId }: { commentId: string; postId: string }) => {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(variables.postId) });
    },
  });

  // ─── Post Mutations ───────────────────────────────────────
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', userId!);
      if (error) throw error;
    },
    onSettled: () => {
      // Invalidate all feed queries so the deleted post disappears
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const reportPostMutation = useMutation({
    mutationFn: async ({
      postId,
      reason,
      description,
    }: {
      postId: string;
      reason: 'spam' | 'abuse' | 'fake' | 'inappropriate';
      description?: string;
    }) => {
      const { error } = await supabase.from('reports').insert({
        reporter_id: userId!,
        post_id: postId,
        reason,
        description: description ?? null,
      });
      if (error) throw error;
    },
  });

  const reportCommentMutation = useMutation({
    mutationFn: async ({
      commentId,
      reason,
      description,
    }: {
      commentId: string;
      reason: 'spam' | 'abuse' | 'fake' | 'inappropriate';
      description?: string;
    }) => {
      const { error } = await supabase.from('reports').insert({
        reporter_id: userId!,
        comment_id: commentId,
        reason,
        description: description ?? null,
      });
      if (error) throw error;
    },
  });

  // ─── Imperative helpers ───────────────────────────────────
  const isLiked = (postId: string) => likedIds.has(postId);
  const isBookmarked = (postId: string) => bookmarkedIds.has(postId);

  const toggleLike = (postId: string) => toggleLikeMutation.mutateAsync(postId);
  const toggleBookmark = (postId: string) => toggleBookmarkMutation.mutateAsync(postId);

  const fetchComments = async (
    postId: string,
  ): Promise<(Comment & { username: string; avatar_url: string | null })[]> => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:users!comments_user_id_fkey(username, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch comments:', error);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      username: row.user?.username ?? 'Unbekannt',
      avatar_url: row.user?.avatar_url ?? null,
    }));
  };

  const addComment = async (postId: string, content: string) => {
    if (!userId || !content.trim()) return null;
    try {
      return await addCommentMutation.mutateAsync({ postId, content });
    } catch (err) {
      console.error('Failed to add comment:', err);
      return null;
    }
  };

  const deleteComment = async (commentId: string, postId: string) => {
    if (!userId) return;
    try {
      await deleteCommentMutation.mutateAsync({ commentId, postId });
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const reportPost = async (
    postId: string,
    reason: 'spam' | 'abuse' | 'fake' | 'inappropriate',
    description?: string,
  ) => {
    if (!userId) return;
    await reportPostMutation.mutateAsync({ postId, reason, description });
  };

  const reportComment = async (
    commentId: string,
    reason: 'spam' | 'abuse' | 'fake' | 'inappropriate',
    description?: string,
  ) => {
    if (!userId) return;
    await reportCommentMutation.mutateAsync({ commentId, reason, description });
  };

  const deletePost = async (postId: string) => {
    if (!userId) return;
    await deletePostMutation.mutateAsync(postId);
  };

  return {
    likedIds,
    bookmarkedIds,
    isLiked,
    isBookmarked,
    toggleLike,
    toggleBookmark,
    fetchComments,
    addComment,
    deleteComment,
    reportPost,
    reportComment,
    deletePost,
  };
}
