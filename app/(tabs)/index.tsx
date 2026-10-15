import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants';
import { useFeed } from '../../hooks/useFeed';
import { usePostActions } from '../../hooks/usePostActions';
import { useAuthStore } from '../../stores/authStore';
import PostCard from '../../components/feed/PostCard';
import CommentSection from '../../components/feed/CommentSection';
import ReportModal from '../../components/feed/ReportModal';
import type { FeedPost } from '../../types';

export default function FeedScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const [activeTab, setActiveTab] = useState<'main' | 'explore'>('main');
  const {
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
  } = useFeed();
  const {
    isLiked,
    isBookmarked,
    toggleLike,
    toggleBookmark,
    reportPost,
    deletePost,
  } = usePostActions();

  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  useEffect(() => {
    fetchMainFeed(true);
    fetchExploreFeed(true);
  }, []);

  const posts = activeTab === 'main' ? mainPosts : explorePosts;
  const isLoading = activeTab === 'main' ? isLoadingMain : isLoadingExplore;
  const hasMore = activeTab === 'main' ? hasMoreMain : hasMoreExplore;

  const handleLoadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    if (activeTab === 'main') fetchMainFeed();
    else fetchExploreFeed();
  }, [activeTab, isLoading, hasMore, fetchMainFeed, fetchExploreFeed]);

  const handleRefresh = useCallback(() => {
    refreshFeed(activeTab);
  }, [activeTab, refreshFeed]);

  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        await deletePost(postId);
        refreshFeed(activeTab);
      } catch {
        // Delete may fail silently — ignored
      }
    },
    [deletePost, refreshFeed, activeTab],
  );

  const renderPost = useCallback(
    ({ item }: { item: FeedPost }) => (
      <PostCard
        post={item}
        route={item.route ?? undefined}
        isLiked={isLiked(item.id)}
        isBookmarked={isBookmarked(item.id)}
        isOwnPost={item.user_id === userId}
        onLike={() => toggleLike(item.id)}
        onBookmark={() => toggleBookmark(item.id)}
        onComment={() => setCommentPostId(item.id)}
        onReport={() => setReportPostId(item.id)}
        onDelete={() => handleDeletePost(item.id)}
      />
    ),
    [isLiked, isBookmarked, userId, toggleLike, toggleBookmark, handleDeletePost],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TrailMate</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => router.push('/create-post')}
        >
          <Ionicons name="add-circle" size={30} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'main' && styles.tabActive]}
          onPress={() => setActiveTab('main')}
        >
          <Text style={[styles.tabText, activeTab === 'main' && styles.tabTextActive]}>
            Feed
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'explore' && styles.tabActive]}
          onPress={() => setActiveTab('explore')}
        >
          <Text style={[styles.tabText, activeTab === 'explore' && styles.tabTextActive]}>
            Entdecken
          </Text>
        </Pressable>
      </View>

      {/* Feed List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Beiträge laden...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeTab === 'main' ? 'people-outline' : 'compass-outline'}
                size={48}
                color={Colors.textLight}
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'main'
                  ? 'Noch keine Beiträge'
                  : 'Keine Beiträge zum Entdecken'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'main'
                  ? 'Folge anderen Wanderern, um ihre Beiträge hier zu sehen.'
                  : 'Sei der Erste, der einen Beitrag teilt!'}
              </Text>
              <Pressable
                style={styles.emptyButton}
                onPress={() => router.push('/create-post')}
              >
                <Ionicons name="add" size={18} color={Colors.surface} />
                <Text style={styles.emptyButtonText}>Beitrag erstellen</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          isLoading && posts.length > 0 ? (
            <ActivityIndicator
              size="small"
              color={Colors.primary}
              style={styles.footerLoader}
            />
          ) : null
        }
      />

      {/* Comment Section */}
      {commentPostId && (
        <CommentSection
          postId={commentPostId}
          visible={!!commentPostId}
          onClose={() => setCommentPostId(null)}
        />
      )}

      {/* Report Modal */}
      <ReportModal
        visible={!!reportPostId}
        onClose={() => setReportPostId(null)}
        onSubmit={async (reason, description) => {
          if (reportPostId) {
            await reportPost(reportPostId, reason, description);
          }
        }}
      />
    </View>
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
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  createButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingBottom: 2,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
  },
});
