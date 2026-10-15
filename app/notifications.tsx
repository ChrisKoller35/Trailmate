import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { useNotifications, useMarkAsRead, useMarkAllRead } from '../hooks/useNotifications';
import type { Notification, NotificationType } from '../types';

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  follow: 'person-add',
  like: 'heart',
  comment: 'chatbubble',
  dm: 'mail',
  badge: 'ribbon',
  challenge: 'trophy',
  group_invite: 'people',
  event_reminder: 'calendar',
  trail_condition: 'warning',
  system: 'information-circle',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `vor ${days} T`;
  if (hours > 0) return `vor ${hours} Std`;
  if (minutes > 0) return `vor ${minutes} Min`;
  return 'gerade eben';
}

export default function NotificationsScreen() {
  const { data: notifications, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllRead = useMarkAllRead();

  const handlePress = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const iconName = NOTIFICATION_ICONS[item.type] || 'notifications';

    return (
      <Pressable
        style={[styles.notificationRow, !item.is_read && styles.unreadRow]}
        onPress={() => handlePress(item)}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={iconName as any} size={22} color={Colors.primary} />
        </View>
        <View style={styles.contentContainer}>
          {item.title && <Text style={styles.notificationTitle}>{item.title}</Text>}
          {item.body && (
            <Text style={styles.notificationBody} numberOfLines={2}>
              {item.body}
            </Text>
          )}
          <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
        </View>
        {!item.is_read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Benachrichtigungen' }} />

      <View style={styles.header}>
        <Pressable
          style={styles.markAllButton}
          onPress={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
        >
          <Ionicons name="checkmark-done" size={18} color={Colors.primary} />
          <Text style={styles.markAllText}>Alle als gelesen markieren</Text>
        </Pressable>
      </View>

      <FlatList
        data={notifications ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>Keine Benachrichtigungen</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
  },
  markAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  listContent: {
    flexGrow: 1,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  unreadRow: {
    backgroundColor: Colors.surfaceVariant,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  notificationBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  timeText: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.info,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
