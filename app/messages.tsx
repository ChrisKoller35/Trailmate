import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants';
import { useDMs } from '../hooks/useDMs';
import { usePostMessages } from '../hooks/usePostMessages';
import Avatar from '../components/ui/Avatar';
import type { Conversation } from '../hooks/useDMs';
import type { PostMessageThread } from '../hooks/usePostMessages';

type Tab = 'dms' | 'postbox';

export default function MessagesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('dms');

  const { conversations, fetchConversations, unreadTotal } = useDMs();
  const { postInbox, fetchPostInbox, unreadPostMessageCount } = usePostMessages();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchConversations(), fetchPostInbox()]);
      setLoading(false);
    };
    load();
  }, [fetchConversations, fetchPostInbox]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 7) return `vor ${diffDays}T`;
    return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <Pressable
      style={styles.conversationRow}
      onPress={() => router.push(`/chat?userId=${item.otherUserId}`)}
    >
      <Avatar uri={item.avatar_url} size={48} />
      <View style={styles.convInfo}>
        <View style={styles.convHeader}>
          <Text style={styles.convName} numberOfLines={1}>
            {item.display_name || item.username}
          </Text>
          <Text style={styles.convTime}>{formatTime(item.lastMessageAt)}</Text>
        </View>
        <View style={styles.convPreviewRow}>
          <Text style={styles.convPreview} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );

  // Group post inbox by postId
  const postGroups = postInbox.reduce<
    Record<string, { postId: string; threads: PostMessageThread[]; totalUnread: number }>
  >((acc, thread) => {
    if (!acc[thread.postId]) {
      acc[thread.postId] = { postId: thread.postId, threads: [], totalUnread: 0 };
    }
    acc[thread.postId].threads.push(thread);
    acc[thread.postId].totalUnread += thread.unreadCount;
    return acc;
  }, {});

  const postGroupList = Object.values(postGroups).sort(
    (a, b) =>
      new Date(b.threads[0].lastMessageAt).getTime() -
      new Date(a.threads[0].lastMessageAt).getTime(),
  );

  const renderPostGroup = ({
    item,
  }: {
    item: { postId: string; threads: PostMessageThread[]; totalUnread: number };
  }) => (
    <Pressable
      style={styles.conversationRow}
      onPress={() => router.push(`/post-messages?postId=${item.postId}`)}
    >
      <View style={styles.postIcon}>
        <Ionicons name="mail-outline" size={24} color={Colors.primary} />
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convHeader}>
          <Text style={styles.convName} numberOfLines={1}>
            Beitrag-Nachrichten
          </Text>
          <Text style={styles.convTime}>
            {formatTime(item.threads[0].lastMessageAt)}
          </Text>
        </View>
        <View style={styles.convPreviewRow}>
          <Text style={styles.convPreview} numberOfLines={1}>
            {item.threads.length} {item.threads.length === 1 ? 'Nachricht' : 'Nachrichten'}
          </Text>
          {item.totalUnread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.totalUnread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Nachrichten</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'dms' && styles.tabActive]}
          onPress={() => setActiveTab('dms')}
        >
          <Text style={[styles.tabText, activeTab === 'dms' && styles.tabTextActive]}>
            DMs
            {unreadTotal > 0 ? ` (${unreadTotal})` : ''}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'postbox' && styles.tabActive]}
          onPress={() => setActiveTab('postbox')}
        >
          <Text style={[styles.tabText, activeTab === 'postbox' && styles.tabTextActive]}>
            Post-Postfach
            {unreadPostMessageCount > 0 ? ` (${unreadPostMessageCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'dms' ? (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.otherUserId}
          renderItem={renderConversation}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyText}>Noch keine Konversationen</Text>
              <Text style={styles.emptySubText}>
                Du kannst Nachrichten an gegenseitige Follower senden
              </Text>
            </View>
          }
          contentContainerStyle={conversations.length === 0 ? { flex: 1 } : undefined}
        />
      ) : (
        <FlatList
          data={postGroupList}
          keyExtractor={(item) => item.postId}
          renderItem={renderPostGroup}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="mail-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyText}>Kein Post-Postfach</Text>
              <Text style={styles.emptySubText}>
                Hier siehst du Nachrichten zu deinen Beiträgen
              </Text>
            </View>
          }
          contentContainerStyle={postGroupList.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  convInfo: {
    flex: 1,
    marginLeft: 12,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  convTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  convPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  convPreview: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  postIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubText: {
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
  },
});
