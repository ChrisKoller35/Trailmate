import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  Pressable,
  Alert,
  ActivityIndicator,
  Share,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants';
import { useGroups } from '../hooks/useGroups';
import { useEvents } from '../hooks/useEvents';
import { useAuthStore } from '../stores/authStore';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import type { Group, GroupMember, GroupEvent, GroupRole } from '../types';

type Tab = 'posts' | 'events' | 'members';

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const {
    getGroupDetail,
    joinGroup,
    leaveGroup,
    removeMember,
    updateMemberRole,
    deleteGroup,
    generateInviteCode,
    getGroupRole,
  } = useGroups();

  const { respondToEvent, getEventResponses } = useEvents();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<(GroupMember & { user: any })[]>([]);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [myRole, setMyRole] = useState<GroupRole | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);
  const [eventResponses, setEventResponses] = useState<Record<string, any[]>>({});

  const isMember = myRole !== null;
  const isAdmin = myRole === 'admin';
  const isMod = myRole === 'moderator';

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const detail = await getGroupDetail(id);
    setGroup(detail.group);
    setMembers(detail.members);
    setEvents(detail.events as GroupEvent[]);

    if (currentUser?.id) {
      const role = await getGroupRole(id);
      setMyRole(role);
    }
    setLoading(false);
  }, [id, getGroupDetail, getGroupRole, currentUser?.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleJoin = async () => {
    if (!id) return;
    await joinGroup(id);
    await loadDetail();
  };

  const handleLeave = () => {
    Alert.alert('Gruppe verlassen', 'Möchtest du diese Gruppe wirklich verlassen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Verlassen',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await leaveGroup(id);
          router.back();
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Gruppe löschen', 'Diese Aktion kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deleteGroup(id);
          router.back();
        },
      },
    ]);
  };

  const handleShareInvite = async () => {
    if (!group?.invite_code) return;
    try {
      await Share.share({
        message: `Tritt meiner TrailMate-Gruppe "${group.name}" bei! Einladungscode: ${group.invite_code}`,
      });
    } catch {
      // Share may fail silently — ignored
    }
  };

  const handleRSVP = async (eventId: string, response: 'attending' | 'declined' | 'maybe') => {
    await respondToEvent(eventId, response);
    const responses = await getEventResponses(eventId);
    setEventResponses((prev) => ({ ...prev, [eventId]: responses }));
  };

  const renderMember = ({ item }: { item: GroupMember & { user: any } }) => {
    const isMe = item.user_id === currentUser?.id;

    return (
      <View style={styles.memberRow}>
        <Avatar uri={item.user?.avatar_url ?? null} size={40} />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {item.user?.display_name || item.user?.username || 'Unbekannt'}
          </Text>
          <View style={styles.roleBadgeRow}>
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
        {isAdmin && !isMe && (
          <Pressable
            onPress={() =>
              Alert.alert('Mitglied verwalten', '', [
                {
                  text: 'Zum Mod machen',
                  onPress: () => updateMemberRole(id!, item.user_id, 'moderator'),
                },
                {
                  text: 'Entfernen',
                  style: 'destructive',
                  onPress: () => removeMember(id!, item.user_id),
                },
                { text: 'Abbrechen', style: 'cancel' },
              ])
            }
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>
    );
  };

  const renderEvent = ({ item }: { item: GroupEvent }) => {
    const date = new Date(item.event_date);
    const responses = eventResponses[item.id] || [];
    const attendingCount = responses.filter((r: any) => r.response === 'attending').length;

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventDateBadge}>
          <Text style={styles.eventDay}>{date.getDate()}</Text>
          <Text style={styles.eventMonth}>
            {date.toLocaleDateString('de-CH', { month: 'short' })}
          </Text>
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <Text style={styles.eventMeta}>
            {date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr
            {item.meeting_point ? ` · ${item.meeting_point}` : ''}
          </Text>
          {attendingCount > 0 && (
            <Text style={styles.eventAttending}>
              {attendingCount} {attendingCount === 1 ? 'Zusage' : 'Zusagen'}
            </Text>
          )}
          <View style={styles.rsvpRow}>
            <Pressable
              style={[styles.rsvpButton, styles.rsvpAttend]}
              onPress={() => handleRSVP(item.id, 'attending')}
            >
              <Text style={styles.rsvpButtonTextAttend}>Zusagen</Text>
            </Pressable>
            <Pressable
              style={[styles.rsvpButton, styles.rsvpMaybe]}
              onPress={() => handleRSVP(item.id, 'maybe')}
            >
              <Text style={styles.rsvpButtonText}>Vielleicht</Text>
            </Pressable>
            <Pressable
              style={[styles.rsvpButton, styles.rsvpDecline]}
              onPress={() => handleRSVP(item.id, 'declined')}
            >
              <Text style={styles.rsvpButtonText}>Absagen</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Gruppe nicht gefunden</Text>
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
          {group.name}
        </Text>
        {isAdmin ? (
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={22} color={Colors.error} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {/* Group Info */}
      <View style={styles.groupInfoSection}>
        <View style={styles.groupCover}>
          <Ionicons name="people" size={36} color={Colors.primaryLight} />
        </View>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.description && (
          <Text style={styles.groupDescription}>{group.description}</Text>
        )}
        <View style={styles.groupStats}>
          <Text style={styles.statText}>
            {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'}
          </Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statText}>
            {group.is_private ? 'Private Gruppe' : 'Öffentliche Gruppe'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {!isMember ? (
            <Button title="Beitreten" onPress={handleJoin} />
          ) : (
            <>
              {group.is_private && (isAdmin || isMod) && group.invite_code && (
                <Pressable style={styles.actionButton} onPress={handleShareInvite}>
                  <Ionicons name="link-outline" size={20} color={Colors.primary} />
                  <Text style={styles.actionButtonText}>Einladen</Text>
                </Pressable>
              )}
              {(isAdmin || isMod) && (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.push(`/create-event?groupId=${id}`)}
                >
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                  <Text style={styles.actionButtonText}>Event</Text>
                </Pressable>
              )}
              <Pressable style={styles.actionButton} onPress={handleLeave}>
                <Ionicons name="exit-outline" size={20} color={Colors.error} />
                <Text style={[styles.actionButtonText, { color: Colors.error }]}>Verlassen</Text>
              </Pressable>
            </>
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
          <Text style={styles.emptyText}>Noch keine Gruppen-Beiträge</Text>
        </View>
      )}

      {activeTab === 'events' && (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>Keine kommenden Events</Text>
            </View>
          }
          contentContainerStyle={events.length === 0 ? { flex: 1 } : undefined}
        />
      )}

      {activeTab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          renderItem={renderMember}
          contentContainerStyle={members.length === 0 ? { flex: 1 } : undefined}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Keine Mitglieder</Text>
            </View>
          }
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
  groupInfoSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  groupCover: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  groupDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statDot: {
    fontSize: 13,
    color: Colors.textLight,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    width: '100%',
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
  roleBadgeRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
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
  eventCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  eventDateBadge: {
    width: 48,
    height: 52,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDay: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  eventMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primaryLight,
    textTransform: 'uppercase',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  eventMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  eventAttending: {
    fontSize: 12,
    color: Colors.primaryLight,
    marginTop: 2,
  },
  rsvpRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  rsvpButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  rsvpAttend: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rsvpMaybe: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
  rsvpDecline: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
  rsvpButtonTextAttend: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
  rsvpButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
  },
});
