import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { useAuthStore } from '../stores/authStore';
import { useBadges, type BadgeWithStatus } from '../hooks/useBadges';

const RARITY_COLORS: Record<string, string> = {
  normal: Colors.textSecondary,
  rare: Colors.info,
  epic: '#7C3AED',
};

const CATEGORY_HEADERS: { category: string; emoji: string; label: string }[] = [
  { category: 'summits', emoji: '🏔️', label: 'Gipfel & Routen' },
  { category: 'sports', emoji: '📏', label: 'Sportliche Leistungen' },
  { category: 'social', emoji: '👥', label: 'Soziale Abzeichen' },
  { category: 'fun', emoji: '☕', label: 'Fun & Hütten' },
  { category: 'weather', emoji: '🌦️', label: 'Wetter & Jahreszeiten' },
  { category: 'activity', emoji: '⏰', label: 'Aktivität' },
  { category: 'special', emoji: '⭐', label: 'Spezial' },
];

function BadgeItem({ badge }: { badge: BadgeWithStatus }) {
  const borderColor = RARITY_COLORS[badge.rarity ?? 'normal'] ?? Colors.textSecondary;

  return (
    <View style={[styles.badgeItem, { opacity: badge.earned ? 1 : 0.3 }]}>
      <View style={[styles.badgeCircle, { borderColor }]}>
        <Text style={styles.badgeEmoji}>{badge.icon_url ?? '🏅'}</Text>
        {badge.earned && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          </View>
        )}
      </View>
      <Text style={styles.badgeName} numberOfLines={2}>
        {badge.name ?? 'Abzeichen'}
      </Text>
    </View>
  );
}

export default function BadgesScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: badges, isLoading } = useBadges(userId);

  const earnedCount = badges?.filter((b) => b.earned).length ?? 0;
  const totalCount = badges?.length ?? 0;

  const grouped = CATEGORY_HEADERS.map((cat) => ({
    ...cat,
    badges: (badges ?? []).filter((b) => b.category === cat.category),
  })).filter((g) => g.badges.length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Meine Abzeichen' }} />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.headerCount}>
            {earnedCount} von {totalCount} Abzeichen
          </Text>

          {grouped.map((group) => (
            <View key={group.category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>
                {group.emoji} {group.label}
              </Text>
              <View style={styles.badgeGrid}>
                {group.badges.map((badge) => (
                  <BadgeItem key={badge.id} badge={badge} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
  headerCount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeItem: {
    width: 80,
    alignItems: 'center',
  },
  badgeCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeEmoji: {
    fontSize: 24,
  },
  checkmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  badgeName: {
    fontSize: 11,
    color: Colors.text,
    textAlign: 'center',
  },
});
