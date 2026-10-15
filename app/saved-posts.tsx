import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import Avatar from '../components/ui/Avatar';
import type { Post, User } from '../types';

interface SavedPost extends Post {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function SavedPostsScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const [activeTab, setActiveTab] = useState<'posts' | 'routes'>('posts');
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSavedPosts = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select(`
          post_id,
          post:posts(*, user:users!posts_user_id_fkey(username, display_name, avatar_url))
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: SavedPost[] = (data ?? [])
        .map((row: any) => ({
          ...row.post,
          username: row.post?.user?.username ?? 'Unbekannt',
          display_name: row.post?.user?.display_name ?? null,
          avatar_url: row.post?.user?.avatar_url ?? null,
        }))
        .filter((p: any) => p.id);

      setPosts(mapped);
    } catch (err) {
      console.error('Failed to load saved posts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSavedPosts();
  }, [loadSavedPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSavedPosts();
    setRefreshing(false);
  };

  const removeBookmark = async (postId: string) => {
    if (!userId) return;
    await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gespeichert</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            Posts
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'routes' && styles.tabActive]}
          onPress={() => {
            setActiveTab('routes');
            router.push('/saved-routes');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'routes' && styles.tabTextActive]}>
            Routen
          </Text>
        </Pressable>
      </View>

      {/* Saved Posts List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>Keine gespeicherten Beiträge</Text>
            <Text style={styles.emptyText}>
              Speichere Beiträge mit dem Lesezeichen-Symbol, um sie hier wiederzufinden.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.savedCard}>
            <View style={styles.savedCardHeader}>
              <Avatar uri={item.avatar_url} size={36} />
              <View style={styles.savedCardMeta}>
                <Text style={styles.savedCardUsername}>@{item.username}</Text>
                <Text style={styles.savedCardDate}>
                  {new Date(item.created_at).toLocaleDateString('de-CH', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
              <Pressable onPress={() => removeBookmark(item.id)} hitSlop={8}>
                <Ionicons name="bookmark" size={20} color={Colors.primary} />
              </Pressable>
            </View>

            {item.content && (
              <Text style={styles.savedCardContent} numberOfLines={2}>
                {item.content}
              </Text>
            )}

            {item.media_urls && item.media_urls.length > 0 && (
              <Image
                source={{ uri: item.media_urls[0].url }}
                style={styles.savedCardThumb}
                resizeMode="cover"
              />
            )}

            <View style={styles.savedCardStats}>
              <Text style={styles.savedCardStatText}>❤️ {item.likes_count}</Text>
              <Text style={styles.savedCardStatText}>💬 {item.comments_count}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  savedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  savedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  savedCardMeta: {
    flex: 1,
  },
  savedCardUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  savedCardDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  savedCardContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 19,
    marginBottom: 8,
  },
  savedCardThumb: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
  },
  savedCardStats: {
    flexDirection: 'row',
    gap: 12,
  },
  savedCardStatText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
