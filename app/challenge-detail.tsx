import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { showErrorToast } from '../lib/toast';
import { useAuthStore } from '../stores/authStore';
import {
  useChallenge,
  useChallengeParticipation,
  useJoinChallenge,
  useLeaderboard,
} from '../hooks/useChallenges';

function formatDaysRemaining(endDate: string | null): string {
  if (!endDate) return '';
  const diff = new Date(endDate).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diff / 86_400_000));
  return days === 1 ? '1 Tag übrig' : `${days} Tage übrig`;
}

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);

  const { data, isLoading } = useChallenge(id);
  const { data: participation } = useChallengeParticipation(id, userId);
  const { data: leaderboard } = useLeaderboard(id);
  const joinMutation = useJoinChallenge();

  const challenge = data?.challenge;
  const participantCount = data?.participantCount ?? 0;

  const handleJoin = () => {
    if (!id) return;
    joinMutation.mutate(id, {
      onError: () => showErrorToast('Konnte Challenge nicht beitreten.'),
    });
  };

  if (isLoading || !challenge) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Challenge' }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const goal = challenge.goal as Record<string, number> | null;
  const goalValue = goal?.target_km ?? goal?.target_m ?? goal?.target ?? 0;
  const progress = participation?.progress ?? 0;
  const progressPct = goalValue > 0 ? Math.min(progress / goalValue, 1) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: challenge.title }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{challenge.title}</Text>
        {challenge.description && (
          <Text style={styles.description}>{challenge.description}</Text>
        )}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{participantCount} Teilnehmer</Text>
          </View>
          {challenge.end_date && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.metaText}>
                {formatDaysRemaining(challenge.end_date)}
              </Text>
            </View>
          )}
        </View>

        {participation ? (
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>Dein Fortschritt</Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progressPct * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {progress.toFixed(1)} / {goalValue} {goal?.unit ?? 'km'}
            </Text>
          </View>
        ) : (
          <Pressable
            style={styles.joinButton}
            onPress={handleJoin}
            disabled={joinMutation.isPending}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.joinButtonText}>
              {joinMutation.isPending ? 'Beitreten...' : 'Challenge beitreten'}
            </Text>
          </Pressable>
        )}

        {/* Leaderboard */}
        <Text style={styles.sectionTitle}>Rangliste</Text>
        {leaderboard?.length ? (
          leaderboard.map((entry, index) => {
            const isMe = entry.user_id === userId;
            return (
              <View
                key={entry.user_id}
                style={[styles.leaderRow, isMe && styles.leaderRowMe]}
              >
                <Text style={styles.leaderRank}>{index + 1}</Text>
                <View style={styles.leaderInfo}>
                  <Text
                    style={[styles.leaderName, isMe && styles.leaderNameMe]}
                    numberOfLines={1}
                  >
                    {entry.display_name ?? entry.username}
                  </Text>
                </View>
                <Text style={styles.leaderProgress}>
                  {entry.progress.toFixed(1)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>
            Noch keine Teilnehmer in der Rangliste.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  progressSection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  joinButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 24,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  leaderRowMe: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  leaderRank: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: 15,
    color: Colors.text,
  },
  leaderNameMe: {
    fontWeight: '600',
    color: Colors.primary,
  },
  leaderProgress: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 12,
  },
});
