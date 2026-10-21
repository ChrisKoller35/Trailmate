import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { queryKeys } from '../lib/queryKeys';
import { showErrorToast } from '../lib/toast';
import type { DirectMessage } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Conversation {
  otherUserId: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function useDMs() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ─── Conversations query ─────────────────────────────────
  const conversationsQuery = useQuery({
    queryKey: queryKeys.dms.conversations(userId ?? ''),
    queryFn: async (): Promise<Conversation[]> => {
      if (!userId) return [];

      // Load blocked users
      const { data: blockedData } = await supabase
        .from('blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

      const blockedSet = new Set(
        (blockedData ?? []).map((b: any) =>
          b.blocker_id === userId ? b.blocked_id : b.blocker_id,
        ),
      );

      // Load all DMs, grouped by conversation partner
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (!data) return [];

      // Group by conversation partner (skip blocked)
      const convMap = new Map<string, { messages: DirectMessage[]; unread: number }>();

      for (const msg of data as DirectMessage[]) {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (blockedSet.has(otherId)) continue;
        if (!convMap.has(otherId)) {
          convMap.set(otherId, { messages: [], unread: 0 });
        }
        const entry = convMap.get(otherId)!;
        entry.messages.push(msg);
        if (!msg.is_read && msg.receiver_id === userId) {
          entry.unread++;
        }
      }

      // Load user info for all conversation partners
      const otherIds = Array.from(convMap.keys());
      if (otherIds.length === 0) return [];

      const { data: users } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .in('id', otherIds);

      const userMap = new Map(
        (users ?? []).map((u: any) => [u.id, u]),
      );

      const convList: Conversation[] = otherIds
        .map((otherId) => {
          const entry = convMap.get(otherId)!;
          const user = userMap.get(otherId);
          const lastMsg = entry.messages[0]; // Already sorted DESC by created_at
          return {
            otherUserId: otherId,
            username: user?.username ?? 'Unbekannt',
            display_name: user?.display_name ?? null,
            avatar_url: user?.avatar_url ?? null,
            lastMessage: lastMsg.content,
            lastMessageAt: lastMsg.created_at,
            unreadCount: entry.unread,
          };
        })
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      return convList;
    },
    enabled: !!userId,
  });

  const conversations = conversationsQuery.data ?? [];

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  );

  const fetchConversations = useCallback(
    () => conversationsQuery.refetch().then((r) => r.data ?? []),
    [conversationsQuery],
  );

  // ─── Fetch messages for a conversation ──────────────────
  const fetchMessages = useCallback(
    async (otherUserId: string) => {
      if (!userId) return;

      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`,
        )
        .order('created_at', { ascending: false });

      setMessages((data ?? []) as DirectMessage[]);
    },
    [userId],
  );

  // ─── Send message mutation ───────────────────────────────
  const sendMessageMutation = useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: string; content: string }) => {
      if (!userId) throw new Error('Not authenticated');

      const newMsg: Partial<DirectMessage> = {
        sender_id: userId,
        receiver_id: receiverId,
        content,
        is_read: false,
      };

      const { data, error } = await supabase
        .from('direct_messages')
        .insert(newMsg)
        .select()
        .single();

      if (error) throw error;
      return data as DirectMessage;
    },
    onMutate: async ({ receiverId, content }) => {
      if (!userId) return;
      const optimisticMsg: DirectMessage = {
        id: `temp_${Date.now()}`,
        sender_id: userId,
        receiver_id: receiverId,
        content,
        is_read: false,
        created_at: new Date().toISOString(),
      } as DirectMessage;
      setMessages((prev) => [optimisticMsg, ...prev]);
      return { optimisticId: optimisticMsg.id };
    },
    onSuccess: (data, _vars, ctx) => {
      // Replace temp message with real message
      setMessages((prev) =>
        prev.map((m) => (m.id === ctx?.optimisticId ? (data as DirectMessage) : m)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.dms.conversations(userId!) });
    },
    onError: (err, _vars, ctx) => {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== ctx?.optimisticId));
      console.error('Nachricht senden fehlgeschlagen', err);
      // Limit-Fehler der Datenbank (015_limits) haben eine verständliche Meldung
      const code = (err as { code?: string }).code;
      showErrorToast(
        code === '23514' && err.message ? err.message : 'Nachricht konnte nicht gesendet werden.',
      );
    },
  });

  // Fehler zeigt onError als Toast; der Aufrufer erhält null statt einer Ablehnung.
  const sendMessage = useCallback(
    (receiverId: string, content: string): Promise<DirectMessage | null> =>
      sendMessageMutation.mutateAsync({ receiverId, content }).catch(() => null),
    [sendMessageMutation],
  );

  // ─── Mark as read mutation ───────────────────────────────
  const markAsReadMutation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) return;
      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', userId)
        .eq('is_read', false);
    },
    onMutate: async (otherUserId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dms.conversations(userId!) });
      const prev = queryClient.getQueryData<Conversation[]>(queryKeys.dms.conversations(userId!));
      queryClient.setQueryData<Conversation[]>(
        queryKeys.dms.conversations(userId!),
        (old) => (old ?? []).map((c: Conversation) =>
          c.otherUserId === otherUserId ? { ...c, unreadCount: 0 } : c,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(queryKeys.dms.conversations(userId!), ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dms.conversations(userId!) });
    },
  });

  const markAsRead = useCallback(
    (otherUserId: string) => markAsReadMutation.mutateAsync(otherUserId),
    [markAsReadMutation],
  );

  // ─── Realtime subscription ───────────────────────────────
  const subscribeToMessages = useCallback(
    (otherUserId: string) => {
      if (!userId) return () => {};

      // Clean up existing subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`dm:${userId}:${otherUserId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
            filter: `receiver_id=eq.${userId}`,
          },
          (payload) => {
            const newMsg = payload.new as DirectMessage;
            if (newMsg.sender_id === otherUserId) {
              // messages state is sorted DESC (newest first), so prepend new message
              setMessages((prev) => [newMsg, ...prev]);
              queryClient.invalidateQueries({ queryKey: queryKeys.dms.conversations(userId!) });
            }
          },
        )
        .subscribe();

      channelRef.current = channel;

      // Cleanup function
      return () => {
        supabase.removeChannel(channel);
        channelRef.current = null;
      };
    },
    [userId, queryClient],
  );

  // ─── Check DM permission (mutual follow) ─────────────────
  const canDM = useCallback(
    async (otherUserId: string): Promise<boolean> => {
      if (!userId) return false;

      const { data } = await supabase.rpc('check_mutual_follow', {
        user1: userId,
        user2: otherUserId,
      });

      return data === true;
    },
    [userId],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    conversations,
    fetchConversations,
    sendMessage,
    messages,
    fetchMessages,
    markAsRead,
    subscribeToMessages,
    unreadTotal,
    canDM,
  };
}
