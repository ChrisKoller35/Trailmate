import {
  View,
  Text,
  FlatList,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useFollow } from '../hooks/useFollow';
import { useBlock } from '../hooks/useBlock';
import Avatar from '../components/ui/Avatar';
import type { User } from '../types';

export default function FollowersScreen() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const { removeFollower } = useFollow();
  const { blockUser } = useBlock();

  const { data: followers = [], isLoading } = useQuery({
    queryKey: ['followers', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', profile!.id);
      if (!data?.length) return [];
      const ids = data.map((f: { follower_id: string }) => f.follower_id);
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
      return (data ?? []).map((f: { following_id: string }) => f.following_id);
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

  const invalidateFollowLists = () => {
    queryClient.invalidateQueries({ queryKey: ['followers'] });
    queryClient.invalidateQueries({ queryKey: ['current-following-ids'] });
    queryClient.invalidateQueries({ queryKey: ['follower-count'] });
    queryClient.invalidateQueries({ queryKey: ['following-count'] });
  };

  const confirmRemove = (user: User) => {
    const name = user.display_name || user.username;
    Alert.alert('Follower entfernen', `Möchtest du ${name} als Follower entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFollower(user.id);
          } catch {
            // Fehler meldet der Hook per Toast
          }
          invalidateFollowLists();
        },
      },
    ]);
  };

  const confirmBlock = (user: User) => {
    const name = user.display_name || user.username;
    Alert.alert(
      'Blockieren',
      `Möchtest du ${name} blockieren? Ihr folgt euch danach gegenseitig nicht mehr.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Blockieren',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(user.id);
            } catch {
              // Fehler meldet der Hook per Toast
            }
            invalidateFollowLists();
          },
        },
      ],
    );
  };

  const openMenu = (user: User) => {
    Alert.alert(user.display_name || user.username, undefined, [
      { text: 'Entfernen', onPress: () => confirmRemove(user) },
      { text: 'Blockieren', style: 'destructive', onPress: () => confirmBlock(user) },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

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
        {!isMe && (
          <Pressable
            onPress={() => openMenu(item)}
            hitSlop={8}
            style={styles.menuButton}
            accessibilityLabel="Weitere Aktionen"
          >
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.textSecondary} />
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
  menuButton: {
    marginLeft: 8,
    padding: 4,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
  },
});
