import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, HIKING_LEVELS } from '../constants';
import { supabase } from '../lib/supabase';
import { chooseAction, confirmAction } from '../lib/dialog';
import { showErrorToast, showInfoToast, showSuccessToast } from '../lib/toast';
import { getProfileVisibility, FollowStatus } from '../lib/profileVisibility';
import { useFollow } from '../hooks/useFollow';
import { useDMs } from '../hooks/useDMs';
import { useBlock } from '../hooks/useBlock';
import { useAuthStore } from '../stores/authStore';
import Avatar from '../components/ui/Avatar';
import FollowButton from '../components/social/FollowButton';
import type { HikingLevel, ReportReason } from '../types';

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  home_region: string | null;
  hiking_level: HikingLevel | null;
  is_private: boolean | null;
}

interface ProfilePost {
  id: string;
  content: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Belästigung / Missbrauch' },
  { value: 'fake', label: 'Fake-Profil' },
  { value: 'inappropriate', label: 'Unangemessen' },
];

async function countFollows(column: 'follower_id' | 'following_id', id: string): Promise<number> {
  const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq(column, id);
  return count ?? 0;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuthStore((s) => s.user?.id);
  const { getFollowStatus } = useFollow();
  const { canDM } = useDMs();
  const { blockUser } = useBlock();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none');
  const [isMutual, setIsMutual] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(false);
    const { data, error: profileError } = await supabase
      .from('public_profiles')
      .select('id, username, display_name, avatar_url, bio, home_region, hiking_level, is_private')
      .eq('id', id)
      .maybeSingle();
    if (profileError) {
      setError(true);
      setLoading(false);
      return;
    }
    const [status, mutual, followers, following, postsResult] = await Promise.all([
      getFollowStatus(id),
      canDM(id),
      countFollows('following_id', id),
      countFollows('follower_id', id),
      supabase
        .from('posts')
        .select('id, content, likes_count, comments_count, created_at')
        .eq('user_id', id)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    setProfile(data as PublicProfile | null);
    setFollowStatus(status);
    setIsMutual(mutual);
    setCounts({ followers, following });
    setPosts((postsResult.data ?? []) as ProfilePost[]);
    setLoading(false);
  }, [id, getFollowStatus, canDM]);

  useEffect(() => {
    load();
  }, [load]);

  const visibility = getProfileVisibility({ viewerId, profileId: id ?? '', profile, followStatus, isMutual });

  useEffect(() => {
    if (visibility.mode === 'own') router.replace('/(tabs)/profile');
  }, [visibility.mode, router]);

  const handleReport = async () => {
    const reason = await chooseAction(
      'Profil melden',
      REPORT_REASONS.map((r) => ({ label: r.label, value: r.value })),
      'Warum möchtest du dieses Profil melden?',
    );
    if (!reason || !viewerId || !id) return;
    const { error: reportError } = await supabase
      .from('reports')
      .insert({ reporter_id: viewerId, reported_user_id: id, reason, status: 'pending' });
    if (reportError?.code === '23505') showInfoToast('Du hast dieses Profil schon gemeldet.');
    else if (reportError) showErrorToast('Die Meldung konnte nicht gesendet werden.');
    else showSuccessToast('Danke für deine Meldung. Wir prüfen das Profil.');
  };

  const handleBlock = async () => {
    if (!id) return;
    const ok = await confirmAction({
      title: 'Blockieren?',
      message: `@${profile?.username ?? ''} kann dir nicht mehr folgen, schreiben oder deine Beiträge sehen.`,
      confirmText: 'Blockieren',
      destructive: true,
    });
    if (!ok) return;
    try {
      await blockUser(id);
      showSuccessToast('Person blockiert.');
      router.back();
    } catch {
      // Fehler-Toast kommt aus useBlock
    }
  };

  const openMenu = async () => {
    const action = await chooseAction('Profil', [
      { label: 'Melden', value: 'report' },
      { label: 'Blockieren', value: 'block', destructive: true },
    ]);
    if (action === 'report') handleReport();
    if (action === 'block') handleBlock();
  };

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: profile ? `@${profile.username}` : 'Profil',
        headerRight: profile
          ? () => (
              <Pressable onPress={openMenu} hitSlop={8} accessibilityLabel="Weitere Aktionen">
                <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text} />
              </Pressable>
            )
          : undefined,
      }}
    />
  );

  if (loading || visibility.mode === 'own') {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        {header}
        <Ionicons name="person-remove-outline" size={48} color={Colors.textLight} />
        <Text style={styles.emptyTitle}>{error ? 'Profil konnte nicht geladen werden' : 'Profil nicht verfügbar'}</Text>
        {error && (
          <Pressable onPress={load} style={styles.messageButton}>
            <Text style={styles.messageLabel}>Erneut versuchen</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const level = HIKING_LEVELS.find((l) => l.value === profile.hiking_level);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {header}
      <View style={styles.head}>
        <Avatar uri={profile.avatar_url} size={88} />
        <Text style={styles.name}>{profile.display_name ?? profile.username}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        <Text style={styles.meta}>
          {[profile.home_region, level && `${level.emoji} ${level.label}`].filter(Boolean).join(' · ')}
        </Text>
        <Text style={styles.meta}>
          {counts.followers} Follower · {counts.following} Folge ich
        </Text>
        <View style={styles.actions}>
          <FollowButton targetUserId={profile.id} onStatusChange={() => load()} />
          {visibility.showMessage && (
            <Pressable style={styles.messageButton} onPress={() => router.push(`/chat?userId=${profile.id}`)}>
              <Text style={styles.messageLabel}>Nachricht</Text>
            </Pressable>
          )}
        </View>
      </View>

      {visibility.mode === 'private' && (
        <View style={styles.privateBox}>
          <Ionicons name="lock-closed-outline" size={28} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>Privates Profil</Text>
          <Text style={styles.meta}>Folge dieser Person, um ihre Beiträge zu sehen.</Text>
        </View>
      )}

      {visibility.showPosts &&
        (posts.length === 0 ? (
          <Text style={[styles.meta, styles.privateBox]}>Noch keine Beiträge</Text>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.post}>
              <Text style={styles.postText}>{post.content || '📷 Beitrag mit Medien'}</Text>
              <Text style={styles.meta}>
                {new Date(post.created_at).toLocaleDateString('de-CH')} · ♥ {post.likes_count} · 💬 {post.comments_count}
              </Text>
            </View>
          ))
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.background },
  head: { alignItems: 'center', padding: 24, gap: 6, backgroundColor: Colors.surface },
  name: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 8 },
  username: { fontSize: 14, color: Colors.textSecondary },
  bio: { fontSize: 14, color: Colors.text, textAlign: 'center', marginTop: 4 },
  meta: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  messageButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primary },
  messageLabel: { color: Colors.textOnPrimary, fontSize: 13, fontWeight: '600' },
  privateBox: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  post: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  postText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
});
