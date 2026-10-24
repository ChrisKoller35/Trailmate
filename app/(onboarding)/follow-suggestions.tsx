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
import { Colors, HIKING_LEVELS } from '../../constants';
import { showErrorToast } from '../../lib/toast';
import Button from '../../components/ui/Button';
import ProgressIndicator from '../../components/onboarding/ProgressIndicator';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { useFollow } from '../../hooks/useFollow';
import { supabase } from '../../lib/supabase';
import { followAll } from '../../lib/onboardingFollow';
import type { User } from '../../types';

export default function FollowSuggestionsScreen() {
  const router = useRouter();
  const {
    hikingLevel,
    homeRegion,
    completeOnboarding,
    setCurrentStep,
  } = useOnboardingStore();
  const { session, setProfile, setOnboardingComplete } = useAuthStore();
  const { follow } = useFollow();

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
      .order('created_at', { ascending: false })
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

  const selectAll = () => {
    setSelectedIds(new Set(suggestions.map((u) => u.id)));
  };

  // Das Profil hat Schritt 4 gespeichert. setProfile erst hier, weil
  // app/_layout.tsx sonst schon vorher zu den Tabs springt.
  const finish = async (ids: string[]) => {
    if (saving) return;
    setSaving(true);
    try {
      const userId = session?.user?.id;
      if (userId) {
        const { failed } = await followAll(ids, follow);
        if (failed > 0) {
          showErrorToast('Einigen Personen konnte nicht gefolgt werden');
        }
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (profile) {
          setProfile(profile as User);
        }
      }
    } catch (err) {
      console.error('Onboarding finish error:', err);
    }
    completeOnboarding();
    setOnboardingComplete(true);
    router.replace('/(tabs)/explore');
  };

  const renderSuggestion = ({ item }: { item: User }) => {
    const isSelected = selectedIds.has(item.id);
    const levelLabel = HIKING_LEVELS.find((l) => l.value === item.hiking_level)?.label;
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
          {(item.home_region || levelLabel) && (
            <Text style={styles.suggestionMeta}>
              {[item.home_region, levelLabel].filter(Boolean).join(' · ')}
            </Text>
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
              Noch keine Vorschläge in deiner Region
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
              onPress={selectAll}
              variant="outline"
              disabled={saving}
            />
          </>
        )}

        <View style={styles.bottomButtons}>
          <Button
            title="Weiter"
            onPress={() => finish(Array.from(selectedIds))}
            loading={saving}
          />
          <Pressable
            onPress={() => finish([])}
            disabled={saving}
            style={[styles.skipContainer, saving && styles.skipDisabled]}
          >
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
  skipDisabled: {
    opacity: 0.5,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
