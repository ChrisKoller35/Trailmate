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
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Colors } from '../constants';
import { confirmAction } from '../lib/dialog';
import { useCommunities } from '../hooks/useCommunities';
import { useEvents } from '../hooks/useEvents';
import { useAuthStore } from '../stores/authStore';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import type { Community, CommunityMember, CommunityRole } from '../types';

type Tab = 'posts' | 'events' | 'members';

export default function CommunityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const {
    getCommunityDetail,
    requestToJoin,
    leaveCommunity,
    getCommunityRole,
    manageCommunity,
  } = useCommunities();

  useEvents();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<(CommunityMember & { user: any })[]>([]);
  const [myRole, setMyRole] = useState<CommunityRole | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);

  const isMember = myRole !== null;
  const isAdmin = myRole === 'admin';
  const isMod = myRole === 'moderator';

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const detail = await getCommunityDetail(id);
    setCommunity(detail.community);
    setMembers(detail.members);

    if (currentUser?.id) {
      const role = await getCommunityRole(id);
      setMyRole(role);
    }
    setLoading(false);
  }, [id, getCommunityDetail, getCommunityRole, currentUser?.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Zahl offener Anfragen bei jeder Rückkehr auf den Screen neu laden
  const [requestCount, setRequestCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!id || !(isAdmin || isMod)) return;
      manageCommunity
        .getJoinRequests(id)
        .then((r) => setRequestCount(r.length))
        .catch(() => setRequestCount(0));
    }, [id, isAdmin, isMod, manageCommunity]),
  );

  const handleJoin = async () => {
    if (!id) return;
    await requestToJoin(id);
    await loadDetail();
  };

  const handleLeave = async () => {
    const ok = await confirmAction({
      title: 'Community verlassen',
      message: 'Möchtest du diese Community wirklich verlassen?',
      confirmText: 'Verlassen',
      destructive: true,
    });
    if (!ok || !id) return;
    await leaveCommunity(id);
    router.back();
  };

  const renderMember = ({ item }: { item: CommunityMember & { user: any } }) => (
    <View style={styles.memberRow}>
      <Avatar uri={item.user?.avatar_url ?? null} size={40} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {item.user?.display_name || item.user?.username || 'Unbekannt'}
        </Text>
        {item.role !== 'member' && (
          <View
            style={[
              styles.roleBadge,
              item.role === 'admin' && styles.roleBadgeAdmin,
              item.role === 'moderator' && styles.roleBadgeMod,
            ]}
          >
            <Text style={styles.roleBadgeText}>
              {item.role === 'admin' ? 'Admin' : 'Mod'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!community) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Community nicht gefunden</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {community.name}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Community Info */}
      <View style={styles.infoSection}>
        <View style={styles.coverIcon}>
          <Ionicons
            name={community.is_official ? 'shield-checkmark' : 'earth'}
            size={36}
            color={community.is_official ? Colors.primary : Colors.primaryLight}
          />
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.communityName}>{community.name}</Text>
          {community.is_official && (
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
          )}
        </View>
        {community.description && (
          <Text style={styles.description}>{community.description}</Text>
        )}
        <View style={styles.statsRow}>
          {community.category && (
            <Text style={styles.categoryBadge}>{community.category}</Text>
          )}
          {community.region && <Text style={styles.regionText}>{community.region}</Text>}
          <Text style={styles.memberCount}>
            {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          {!isMember ? (
            <Button title="Beitreten" onPress={handleJoin} />
          ) : (
            <View style={styles.memberActions}>
              {(isAdmin || isMod) && (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.push(`/create-event?communityId=${id}`)}
                >
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                  <Text style={styles.actionButtonText}>Event erstellen</Text>
                </Pressable>
              )}
              {(isAdmin || isMod) && (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.push({ pathname: '/join-requests', params: { type: 'community', id } })}
                >
                  <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
                  <Text style={styles.actionButtonText}>Anfragen ({requestCount})</Text>
                </Pressable>
              )}
              <Pressable style={styles.actionButton} onPress={handleLeave}>
                <Ionicons name="exit-outline" size={20} color={Colors.error} />
                <Text style={[styles.actionButtonText, { color: Colors.error }]}>Verlassen</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['posts', 'events', 'members'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'posts' ? 'Beiträge' : tab === 'events' ? 'Events' : 'Mitglieder'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'posts' && (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>Noch keine Community-Beiträge</Text>
        </View>
      )}

      {activeTab === 'events' && (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>Keine kommenden Events</Text>
        </View>
      )}

      {activeTab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          renderItem={renderMember}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Keine Mitglieder</Text>
            </View>
          }
          contentContainerStyle={members.length === 0 ? { flex: 1 } : undefined}
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
    gap: 12,
    padding: 32,
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  infoSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  coverIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  communityName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  regionText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  memberCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  actionRow: {
    marginTop: 16,
    width: '100%',
  },
  memberActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  roleBadgeAdmin: {
    backgroundColor: Colors.primary + '20',
  },
  roleBadgeMod: {
    backgroundColor: Colors.info + '20',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
  },
});
