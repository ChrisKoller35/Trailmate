import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { showErrorToast } from '../../lib/toast';
import Button from '../../components/ui/Button';
import ProgressIndicator from '../../components/onboarding/ProgressIndicator';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/storage';
import type { User } from '../../types';

export default function FollowSuggestionsScreen() {
  const router = useRouter();
  const {
    displayName,
    username,
    avatarUri,
    hikingLevel,
    homeRegion,
    completeOnboarding,
    setCurrentStep,
  } = useOnboardingStore();
  const { session, setProfile } = useAuthStore();

  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrentStep(5);
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    setLoading(true);

    // First, get IDs of already-followed users
    let excludeIds: string[] = [];
    if (session?.user?.id) {
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', session.user.id);
      excludeIds = (followData ?? []).map((f: { following_id: string }) => f.following_id);
    }

    let query = supabase
      .from('users')
      .select('*')
      .not('display_name', 'is', null)
      .limit(15);

    if (homeRegion) {
      query = query.eq('home_region', homeRegion);
    }
    if (hikingLevel) {
      query = query.eq('hiking_level', hikingLevel);
    }
    // Exclude self and already-followed
    if (session?.user?.id) {
      query = query.neq('id', session.user.id);
    }

    const { data } = await query;
    const filtered = (data as User[])?.filter((u) => !excludeIds.includes(u.id)) ?? [];
    setSuggestions(filtered);
    setLoading(false);
  };

  const toggleFollow = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const followAll = () => {
    setSelectedIds(new Set(suggestions.map((u) => u.id)));
  };

  const finish = async () => {
    if (!session?.user?.id) {
      completeOnboarding();
      router.replace('/(tabs)/explore');
      return;
    }
    setSaving(true);

    try {
      // Upload avatar if selected
      let finalAvatarUrl: string | null = null;
      if (avatarUri) {
        const ext = avatarUri.split('.').pop() || 'jpg';
        const result = await uploadAvatar(session.user.id, {
          uri: avatarUri,
          name: `avatar.${ext}`,
          type: `image/${ext}`,
        });
        finalAvatarUrl = result.publicUrl;
      }

      // Save profile to users table (upsert in case row doesn't exist yet)
      const { data: profile } = await supabase
        .from('users')
        .upsert({
          id: session.user.id,
          display_name: displayName,
          username,
          avatar_url: finalAvatarUrl,
          hiking_level: hikingLevel,
          home_region: homeRegion,
        })
        .select()
        .single();

      if (profile) {
        setProfile(profile as User);
      }

      // Insert follows
      if (selectedIds.size > 0) {
        const follows = Array.from(selectedIds).map((followingId) => ({
          follower_id: session.user.id,
          following_id: followingId,
        }));
        await supabase.from('follows').insert(follows);
      }

      completeOnboarding();
      router.replace('/(tabs)/explore');
    } catch (err: any) {
      showErrorToast(err.message ?? 'Onboarding konnte nicht abgeschlossen werden.');
    } finally {
      setSaving(false);
    }
  };

  const renderSuggestion = ({ item }: { item: User }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <View style={styles.suggestionRow}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.suggestionAvatar} />
        ) : (
          <View style={styles.suggestionAvatarPlaceholder}>
            <Ionicons name="person" size={20} color={Colors.textLight} />
          </View>
        )}
        <View style={styles.suggestionInfo}>
          <Text style={styles.suggestionName}>{item.display_name}</Text>
          <Text style={styles.suggestionUsername}>@{item.username}</Text>
          {item.home_region && (
            <Text style={styles.suggestionMeta}>{item.home_region}</Text>
          )}
        </View>
        <Pressable
          style={[
            styles.followBtn,
            isSelected && styles.followBtnActive,
          ]}
          onPress={() => toggleFollow(item.id)}
        >
          <Ionicons
            name={isSelected ? 'checkmark' : 'add'}
            size={18}
            color={isSelected ? Colors.textOnPrimary : Colors.primary}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressIndicator step={5} total={5} />
        <Text style={styles.title}>Wanderer in deiner Nähe</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : suggestions.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              Noch keine Vorschläge verfügbar.
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              renderItem={renderSuggestion}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
            <Button
              title="Allen folgen"
              onPress={followAll}
              variant="outline"
            />
          </>
        )}

        <View style={styles.bottomButtons}>
          <Button
            title="Weiter"
            onPress={finish}
            loading={saving}
          />
          <Pressable onPress={finish} style={styles.skipContainer}>
            <Text style={styles.skipText}>Überspringen</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  listContent: {
    gap: 12,
    paddingBottom: 16,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  suggestionAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  suggestionUsername: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  suggestionMeta: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  followBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  bottomButtons: {
    marginTop: 12,
    gap: 8,
  },
  skipContainer: {
    alignItems: 'center',
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
