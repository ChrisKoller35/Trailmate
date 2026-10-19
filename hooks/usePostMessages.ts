import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import { groupPostMessages } from '../lib/postMessageThreads';
import type { PostMessage } from '../types';

export interface PostMessageThread {
  postId: string;
  otherUserId: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  messages: PostMessage[];
  unreadCount: number;
  lastMessageAt: string;
}

export function usePostMessages() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  // ─── Post inbox query ────────────────────────────────────
  const postInboxQuery = useQuery({
    queryKey: queryKeys.postMessages.inbox(userId ?? ''),
    queryFn: async (): Promise<PostMessageThread[]> => {
      if (!userId) return [];

      const { data } = await supabase
        .from('post_messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (!data) return [];

      // Group by post + conversation partner
      const groups = groupPostMessages(data as PostMessage[], userId);

      // Load user info
      const otherIds = [...new Set(groups.map((g) => g.otherUserId))];
      const { data: users } = otherIds.length > 0
        ? await supabase.from('users').select('id, username, display_name, avatar_url').in('id', otherIds)
        : { data: [] };

      const userMap = new Map((users ?? []).map((u: any) => [u.id, u]));

      return groups.map((g) => {
        const user = userMap.get(g.otherUserId);
        return {
          ...g,
          username: user?.username ?? 'Unbekannt',
          display_name: user?.display_name ?? null,
          avatar_url: user?.avatar_url ?? null,
        };
      });
    },
    enabled: !!userId,
  });

  const postInbox = postInboxQuery.data ?? [];

  const unreadPostMessageCount = useMemo(
    () => postInbox.reduce((sum, t) => sum + t.unreadCount, 0),
    [postInbox],
  );

  const fetchPostInbox = useCallback(
    () => postInboxQuery.refetch(),
    [postInboxQuery],
  );

  // ─── Send post message mutation ──────────────────────────
  const sendPostMessageMutation = useMutation({
    mutationFn: async ({
      postId,
      receiverId,
      content,
    }: {
      postId: string;
      receiverId: string;
      content: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('post_messages')
        .insert({
          post_id: postId,
          sender_id: userId,
          receiver_id: receiverId,
          content,
          is_read: false,
        });

      if (error) {
        console.error('Post-Nachricht senden fehlgeschlagen:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.postMessages.inbox(userId!) });
    },
  });

  const sendPostMessage = useCallback(
    (postId: string, receiverId: string, content: string) =>
      sendPostMessageMutation.mutateAsync({ postId, receiverId, content }),
    [sendPostMessageMutation],
  );

  // ─── Reply to post message mutation ─────────────────────
  const replyToPostMessageMutation = useMutation({
    mutationFn: async ({
      postId,
      senderId,
      content,
    }: {
      postId: string;
      senderId: string;
      content: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('post_messages')
        .insert({
          post_id: postId,
          sender_id: userId,
          receiver_id: senderId,
          content,
          is_read: false,
        });

      if (error) {
        console.error('Antwort senden fehlgeschlagen:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.postMessages.inbox(userId!) });
    },
  });

  const replyToPostMessage = useCallback(
    (postId: string, senderId: string, content: string) =>
      replyToPostMessageMutation.mutateAsync({ postId, senderId, content }),
    [replyToPostMessageMutation],
  );

  // ─── Mark post messages as read mutation ────────────────
  const markPostMessagesReadMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) return;

      await supabase
        .from('post_messages')
        .update({ is_read: true })
        .eq('post_id', postId)
        .eq('receiver_id', userId)
        .eq('is_read', false);
    },
    onMutate: async (postId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.postMessages.inbox(userId!) });
      const prev = queryClient.getQueryData<PostMessageThread[]>(queryKeys.postMessages.inbox(userId!));
      queryClient.setQueryData<PostMessageThread[]>(
        queryKeys.postMessages.inbox(userId!),
        (old) => (old ?? []).map((t: PostMessageThread) =>
          t.postId === postId ? { ...t, unreadCount: 0 } : t,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.postMessages.inbox(userId!), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.postMessages.inbox(userId!) });
    },
  });

  const markPostMessagesRead = useCallback(
    (postId: string) => markPostMessagesReadMutation.mutateAsync(postId),
    [markPostMessagesReadMutation],
  );

  return {
    postInbox,
    fetchPostInbox,
    sendPostMessage,
    replyToPostMessage,
    markPostMessagesRead,
    unreadPostMessageCount,
  };
}
