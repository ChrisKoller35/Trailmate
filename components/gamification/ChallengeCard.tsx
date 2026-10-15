import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import type { Challenge, ChallengeParticipant } from '../../types';

interface ChallengeCardProps {
  challenge: Challenge;
  participation?: ChallengeParticipant | null;
  onPress: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  distance: 'navigate-outline',
  elevation: 'arrow-up-outline',
  tours: 'walk-outline',
  streak: 'flame-outline',
};

function daysRemaining(endDate: string | null): number {
  if (!endDate) return 0;
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000));
}

export default function ChallengeCard({
  challenge,
  participation,
  onPress,
}: ChallengeCardProps) {
  const icon = TYPE_ICONS[challenge.type ?? ''] ?? 'trophy-outline';
  const days = daysRemaining(challenge.end_date);
  const goal = challenge.goal as Record<string, number> | null;
  const goalValue = goal?.target_km ?? goal?.target_m ?? goal?.target ?? 0;
  const progress = participation?.progress ?? 0;
  const progressPct = goalValue > 0 ? Math.min(progress / goalValue, 1) : 0;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon as any} size={20} color={Colors.primary} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {challenge.title}
          </Text>
          {challenge.description && (
            <Text style={styles.description} numberOfLines={2}>
              {challenge.description}
            </Text>
          )}
        </View>
      </View>

      {participation && (
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPct * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.toFixed(1)} / {goalValue} {goal?.unit ?? 'km'}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>
            {days === 1 ? '1 Tag' : `${days} Tage`}
          </Text>
        </View>
        {challenge.is_sponsored && (
          <View style={styles.sponsoredBadge}>
            <Text style={styles.sponsoredText}>Gesponsert</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  progressSection: {
    marginBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sponsoredBadge: {
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sponsoredText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
