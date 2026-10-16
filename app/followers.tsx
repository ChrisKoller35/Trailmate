import {
  View,
  Text,
  FlatList,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import Avatar from '../components/ui/Avatar';
import type { User } from '../types';

export default function FollowersScreen() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();

  const { data: followers = [], isLoading } = useQuery({
    queryKey: ['followers', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', profile!.id);
      if (!data?.length) return [];
      const ids = data.map((f: any) => f.follower_id);
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', ids);
      return (users ?? []) as User[];
    },
    enabled: !!profile?.id,
  });

  // Check who the current user follows
  const { data: currentFollowing = [] } = useQuery({
    queryKey: ['current-following-ids', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profile!.id);
      return (data ?? []).map((f: any) => f.following_id as string);
    },
    enabled: !!profile?.id,
  });

  const toggleFollow = useMutation({
    mutationFn: async ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', profile!.id).eq('following_id', userId);
      } else {
        await supabase.from('follows').insert({ follower_id: profile!.id, following_id: userId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['current-following-ids'] });
      queryClient.invalidateQueries({ queryKey: ['follower-count'] });
      queryClient.invalidateQueries({ queryKey: ['following-count'] });
    },
  });

  const renderItem = ({ item }: { item: User }) => {
    const isFollowing = currentFollowing.includes(item.id);
    const isMe = item.id === profile?.id;

    return (
      <View style={styles.row}>
        <Avatar uri={item.avatar_url} size={44} />
        <View style={styles.info}>
          <Text style={styles.displayName}>{item.display_name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
        {!isMe && (
          <Pressable
            onPress={() => toggleFollow.mutate({ userId: item.id, isFollowing })}
            style={[styles.followButton, isFollowing && styles.followingButton]}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Entfolgen' : 'Folgen'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={followers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Noch keine Follower</Text>
            </View>
          }
          contentContainerStyle={followers.length === 0 ? { flex: 1 } : undefined}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  username: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
  followingButtonText: {
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
  },
});
