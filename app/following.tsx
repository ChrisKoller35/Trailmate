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

export default function FollowingScreen() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();

  const { data: following = [], isLoading } = useQuery({
    queryKey: ['following', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profile!.id);
      if (!data?.length) return [];
      const ids = data.map((f: { following_id: string }) => f.following_id);
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', ids);
      return (users ?? []) as User[];
    },
    enabled: !!profile?.id,
  });

  const unfollow = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from('follows').delete().eq('follower_id', profile!.id).eq('following_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['follower-count'] });
      queryClient.invalidateQueries({ queryKey: ['following-count'] });
    },
  });

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.row}>
      <Avatar uri={item.avatar_url} size={44} />
      <View style={styles.info}>
        <Text style={styles.displayName}>{item.display_name || item.username}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      <Pressable
        onPress={() => unfollow.mutate(item.id)}
        style={styles.unfollowButton}
      >
        <Text style={styles.unfollowText}>Entfolgen</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={following}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Du folgst noch niemandem</Text>
            </View>
          }
          contentContainerStyle={following.length === 0 ? { flex: 1 } : undefined}
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
  unfollowButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unfollowText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
  },
});
