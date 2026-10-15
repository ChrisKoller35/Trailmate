import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import type { UserBadge, Badge } from '../../types';

interface BadgeShowcaseProps {
  badges: (UserBadge & { badge: Badge })[];
  onShowAll?: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  normal: Colors.textSecondary,
  rare: Colors.info,
  epic: '#7C3AED',
};

export default function BadgeShowcase({ badges, onShowAll }: BadgeShowcaseProps) {
  if (badges.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Abzeichen</Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="ribbon-outline" size={32} color={Colors.textLight} />
          <Text style={styles.emptyText}>Noch keine Abzeichen</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Abzeichen</Text>
      <View style={styles.grid}>
        {badges.slice(0, 6).map((item) => (
          <View key={item.badge_id} style={styles.badgeItem}>
            <View style={[styles.badgeIcon, { borderColor: RARITY_COLORS[item.badge?.rarity ?? 'normal'] ?? Colors.textSecondary }]}>
              <Text style={styles.badgeEmoji}>{item.badge?.icon_url ?? '🏅'}</Text>
            </View>
            <Text style={styles.badgeName} numberOfLines={1}>
              {item.badge?.name ?? 'Abzeichen'}
            </Text>
          </View>
        ))}
      </View>
      {badges.length > 6 && (
        <Pressable onPress={onShowAll} style={styles.showAll}>
          <Text style={styles.showAllText}>Alle anzeigen →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  badgeItem: {
    width: '30%',
    alignItems: 'center',
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeEmoji: {
    fontSize: 24,
  },
  badgeName: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 16,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 8,
  },
  showAll: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  showAllText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
});
