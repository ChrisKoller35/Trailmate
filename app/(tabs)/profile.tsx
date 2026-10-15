import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Pressable,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import ProfileHeader from '../../components/profile/ProfileHeader';
import ProfileStats from '../../components/profile/ProfileStats';
import HighlightTours from '../../components/profile/HighlightTours';
import BadgeShowcase from '../../components/profile/BadgeShowcase';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, clear } = useAuthStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clear();
    router.replace('/(auth)/login');
  };
  const userId = profile?.id;

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['profile-stats', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('distance_m, elevation_gain_m')
        .eq('user_id', userId!)
        .eq('is_hidden', false);
      return {
        totalTours: data?.length ?? 0,
        totalKm: Math.round((data?.reduce((sum, r) => sum + (r.distance_m || 0), 0) ?? 0) / 1000),
        totalElevation: Math.round(data?.reduce((sum, r) => sum + (r.elevation_gain_m || 0), 0) ?? 0),
      };
    },
    enabled: !!userId,
  });

  const { data: followerCount = 0, refetch: refetchFollowers } = useQuery({
    queryKey: ['follower-count', userId],
    queryFn: async () => {
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId!);
      return count ?? 0;
    },
    enabled: !!userId,
  });

  const { data: followingCount = 0, refetch: refetchFollowing } = useQuery({
    queryKey: ['following-count', userId],
    queryFn: async () => {
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId!);
      return count ?? 0;
    },
    enabled: !!userId,
  });

  const { data: highlights = [], refetch: refetchHighlights } = useQuery({
    queryKey: ['highlight-tours', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('highlight_tours')
        .select('*, recordings(id, title)')
        .eq('user_id', userId!)
        .order('sort_order');
      return (data ?? []).map((h: any) => ({
        id: h.id,
        title: h.recordings?.title ?? null,
        recording_id: h.recording_id,
      }));
    },
    enabled: !!userId,
  });

  const { data: badges = [], refetch: refetchBadges } = useQuery({
    queryKey: ['user-badges', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_badges')
        .select('*, badge:badges(*)')
        .eq('user_id', userId!)
        .order('earned_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: userPosts = [], refetch: refetchPosts } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, content, media_urls, likes_count, comments_count, created_at')
        .eq('user_id', userId!)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!userId,
  });

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchStats(),
      refetchFollowers(),
      refetchFollowing(),
      refetchHighlights(),
      refetchBadges(),
      refetchPosts(),
    ]);
    setRefreshing(false);
  }, [refetchStats, refetchFollowers, refetchFollowing, refetchHighlights, refetchBadges, refetchPosts]);

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Profil wird geladen…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar with Notifications + Settings */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
          <Ionicons name="notifications-outline" size={24} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
          <Ionicons name="settings-outline" size={24} color={Colors.text} />
        </Pressable>
        <Pressable onPress={handleLogout} hitSlop={8} style={{ marginLeft: 16 }}>
          <Ionicons name="log-out-outline" size={24} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ProfileHeader
          user={profile}
          isOwnProfile
          followerCount={followerCount}
          followingCount={followingCount}
          isFollowing={false}
          onEditPress={() => router.push('/edit-profile')}
          onFollowersPress={() => router.push('/followers')}
          onFollowingPress={() => router.push('/following')}
        />

        <ProfileStats stats={stats ?? { totalTours: 0, totalKm: 0, totalElevation: 0 }} />

        {/* My tours link */}
        <Pressable
          style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/recording-history')}
        >
          <Ionicons name="footsteps-outline" size={20} color={Colors.primary} />
          <Text style={styles.tourLinkText}>Meine Touren</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>

        {/* Saved posts link */}
        <Pressable
          style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/saved-posts')}
        >
          <Ionicons name="bookmark-outline" size={20} color={Colors.primary} />
          <Text style={styles.tourLinkText}>Gespeicherte Beiträge</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>

        {/* Follow requests link (only for private profiles) */}
        {profile?.is_private && (
          <Pressable
            style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/follow-requests')}
          >
            <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
            <Text style={styles.tourLinkText}>Folgeanfragen</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </Pressable>
        )}

        {/* Messages link */}
        <Pressable
          style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/messages')}
        >
          <Ionicons name="chatbubbles-outline" size={20} color={Colors.primary} />
          <Text style={styles.tourLinkText}>Nachrichten</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>

        {/* Groups link */}
        <Pressable
          style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/groups')}
        >
          <Ionicons name="people-outline" size={20} color={Colors.primary} />
          <Text style={styles.tourLinkText}>Gruppen</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>

        {/* Communities link */}
        <Pressable
          style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/communities')}
        >
          <Ionicons name="globe-outline" size={20} color={Colors.primary} />
          <Text style={styles.tourLinkText}>Communities</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>

        {/* Events link */}
        <Pressable
          style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/events')}
        >
          <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
          <Text style={styles.tourLinkText}>Events</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>

        <HighlightTours highlights={highlights} />

        <BadgeShowcase badges={badges} onShowAll={() => router.push('/badges')} />

        {/* Stats link */}
        <Pressable
          style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/stats')}
        >
          <Ionicons name="stats-chart-outline" size={20} color={Colors.primary} />
          <Text style={styles.tourLinkText}>Statistiken</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>

        {/* Challenges link */}
        <Pressable
          style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/challenges')}
        >
          <Ionicons name="trophy-outline" size={20} color={Colors.primary} />
          <Text style={styles.tourLinkText}>Challenges</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>

        {/* Live tracking link */}
        <Pressable
          style={({ pressed }) => [styles.tourLink, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/live-tracking')}
        >
          <Ionicons name="navigate-outline" size={20} color={Colors.primary} />
          <Text style={styles.tourLinkText}>Live-Tracking</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </Pressable>

        {/* Posts */}
        <View style={styles.postsSection}>
          <View style={styles.postsSectionHeader}>
            <Text style={styles.sectionTitle}>Beiträge</Text>
            <Pressable onPress={() => router.push('/create-post')}>
              <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
            </Pressable>
          </View>
          {userPosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={32} color={Colors.textLight} />
              <Text style={styles.emptyText}>Noch keine Beiträge</Text>
            </View>
          ) : (
            <View style={styles.postsGrid}>
              {userPosts.map((post: any) => (
                <View key={post.id} style={styles.postGridItem}>
                  {post.media_urls && post.media_urls.length > 0 ? (
                    <Image
                      source={{ uri: post.media_urls[0].url }}
                      style={styles.postGridImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.postGridTextOnly}>
                      <Text style={styles.postGridText} numberOfLines={3}>
                        {post.content}
                      </Text>
                    </View>
                  )}
                  <View style={styles.postGridOverlay}>
                    <Text style={styles.postGridStat}>❤️ {post.likes_count}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tourLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  tourLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  postsSection: {
    paddingTop: 12,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 16,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 8,
  },
  postsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 4,
  },
  postGridItem: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  postGridImage: {
    width: '100%',
    height: '100%',
  },
  postGridTextOnly: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surfaceVariant,
    padding: 8,
    justifyContent: 'center',
  },
  postGridText: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  postGridOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  postGridStat: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
});
