import { Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { usePermissions } from './usePermissions';
import type { Notification } from '../types';

export function useNotifications() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
  });
}

export function useUnreadCount() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['notifications-unread-count', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .eq('is_read', false);

      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkAsRead() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', userId] });
    },
  });
}

export function useMarkAllRead() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId!)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', userId] });
    },
  });
}

export function useRegisterPushToken() {
  const { requestNotificationPermission } = usePermissions();

  return async function registerPushToken() {
    if (Platform.OS === 'web') return;

    try {
      const granted = await requestNotificationPermission();
      if (!granted) return;

      const Notifications = await import('expo-notifications');

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenData.data;

      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      // Push tokens are private (migration 010): own row in user_private only
      await supabase
        .from('user_private')
        .upsert({ user_id: userId, push_token: pushToken }, { onConflict: 'user_id' });
    } catch {
      // Push notifications not supported on this platform
    }
  };
}
