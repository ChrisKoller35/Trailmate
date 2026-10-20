import { useState, useEffect, useCallback } from 'react';
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
import { confirmAction } from '../lib/dialog';
import { useBlock } from '../hooks/useBlock';
import { supabase } from '../lib/supabase';
import Avatar from '../components/ui/Avatar';
import type { User } from '../types';

interface BlockedUserItem {
  blocked_id: string;
  user?: User;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { getBlockedUsers, unblockUser } = useBlock();
  const [users, setUsers] = useState<BlockedUserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const blocks = await getBlockedUsers();
    if (!blocks?.length) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const ids = blocks.map((b) => b.blocked_id);
    const { data } = await supabase
      .from('users')
      .select('*')
      .in('id', ids);

    const userMap = new Map((data ?? []).map((u: User) => [u.id, u]));
    const enriched = blocks.map((b) => ({
      blocked_id: b.blocked_id,
      user: userMap.get(b.blocked_id) as User | undefined,
    }));
    setUsers(enriched);
    setLoading(false);
  }, [getBlockedUsers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUnblock = async (blockedId: string, displayName?: string) => {
    const ok = await confirmAction({
      title: 'Entblocken',
      message: `Möchtest du ${displayName || 'diesen Benutzer'} wirklich entblocken?`,
      confirmText: 'Entblocken',
    });
    if (!ok) return;
    await unblockUser(blockedId);
    setUsers((prev) => prev.filter((u) => u.blocked_id !== blockedId));
  };

  const renderItem = ({ item }: { item: BlockedUserItem }) => (
    <View style={styles.row}>
      <Avatar uri={item.user?.avatar_url ?? null} size={44} />
      <View style={styles.info}>
        <Text style={styles.displayName}>
          {item.user?.display_name || item.user?.username || 'Unbekannt'}
        </Text>
        {item.user?.username && (
          <Text style={styles.username}>@{item.user.username}</Text>
        )}
      </View>
      <Pressable
        style={styles.unblockButton}
        onPress={() =>
          handleUnblock(item.blocked_id, item.user?.display_name || item.user?.username)
        }
      >
        <Text style={styles.unblockText}>Entblocken</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Blockierte Benutzer</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.blocked_id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="shield-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>Keine blockierten Benutzer</Text>
              <Text style={styles.emptySubText}>
                Blockierte Benutzer können dein Profil und deine Beiträge nicht sehen
              </Text>
            </View>
          }
          contentContainerStyle={users.length === 0 ? { flex: 1 } : undefined}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
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
  unblockButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  unblockText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },
  emptyTitle: {
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
