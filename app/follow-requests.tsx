import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants';
import { useFollow } from '../hooks/useFollow';
import { supabase } from '../lib/supabase';
import Avatar from '../components/ui/Avatar';
import type { FollowRequest, User } from '../types';

interface RequestWithUser extends FollowRequest {
  user?: User;
}

export default function FollowRequestsScreen() {
  const router = useRouter();
  const { getFollowRequests, acceptFollowRequest, rejectFollowRequest } = useFollow();
  const [requests, setRequests] = useState<RequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = await getFollowRequests();
      if (!reqs?.length) {
        setRequests([]);
        return;
      }

      const userIds = reqs.map((r) => r.requester_id);
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);

      const userMap = new Map((users ?? []).map((u: User) => [u.id, u]));
      const enriched: RequestWithUser[] = reqs.map((r) => ({
        ...r,
        user: userMap.get(r.requester_id) as User | undefined,
      }));
      setRequests(enriched);
    } finally {
      setLoading(false);
    }
  }, [getFollowRequests]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAccept = async (requesterId: string) => {
    setActionLoading((prev) => ({ ...prev, [requesterId]: true }));
    await acceptFollowRequest(requesterId);
    setRequests((prev) => prev.filter((r) => r.requester_id !== requesterId));
    setActionLoading((prev) => ({ ...prev, [requesterId]: false }));
  };

  const handleReject = async (requesterId: string) => {
    setActionLoading((prev) => ({ ...prev, [requesterId]: true }));
    await rejectFollowRequest(requesterId);
    setRequests((prev) => prev.filter((r) => r.requester_id !== requesterId));
    setActionLoading((prev) => ({ ...prev, [requesterId]: false }));
  };

  const renderItem = ({ item }: { item: RequestWithUser }) => {
    const user = item.user;
    const isProcessing = actionLoading[item.requester_id];

    return (
      <View style={styles.row}>
        <Avatar uri={user?.avatar_url ?? null} size={48} />
        <View style={styles.info}>
          <Text style={styles.displayName} numberOfLines={1}>
            {user?.display_name || user?.username || 'Unbekannt'}
          </Text>
          <Text style={styles.username}>@{user?.username ?? '???'}</Text>
          {(user?.home_region || user?.hiking_level) && (
            <Text style={styles.meta}>
              {[user.home_region, user.hiking_level].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        {isProcessing ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <View style={styles.actions}>
            <Pressable
              style={styles.acceptButton}
              onPress={() => handleAccept(item.requester_id)}
            >
              <Ionicons name="checkmark" size={18} color={Colors.textOnPrimary} />
            </Pressable>
            <Pressable
              style={styles.rejectButton}
              onPress={() => handleReject(item.requester_id)}
            >
              <Ionicons name="close" size={18} color={Colors.error} />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Follow-Anfragen</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.requester_id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyText}>Keine offenen Anfragen</Text>
            </View>
          }
          contentContainerStyle={requests.length === 0 ? { flex: 1 } : undefined}
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
    gap: 12,
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
  meta: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textLight,
  },
});
