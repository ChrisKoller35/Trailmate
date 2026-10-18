import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { useAuthStore } from '../stores/authStore';
import { useStats, useMonthlyActivity } from '../hooks/useStats';

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  return `${h} h`;
}

export default function YearReviewScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);
  const isPremium = profile?.is_premium ?? false;
  const currentYear = new Date().getFullYear();

  const { data: stats, isLoading } = useStats(userId, 'year');
  const { data: monthly } = useMonthlyActivity(userId, currentYear);

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Jahresrückblick' }} />
        <View style={styles.premiumBlock}>
          <Ionicons name="lock-closed" size={48} color={Colors.warning} />
          <Text style={styles.premiumTitle}>Premium Feature</Text>
          <Text style={styles.premiumSubtitle}>
            Upgrade auf Premium, um deinen Jahresrückblick zu sehen.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading || !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Jahresrückblick' }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Find most active month
  const mostActiveMonth = monthly?.reduce(
    (best, m) => (m.tours > (best?.tours ?? 0) ? m : best),
    monthly[0]
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Jahresrückblick' }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerEmoji}>🎉</Text>
        <Text style={styles.headerTitle}>Dein Wanderjahr {currentYear}</Text>

        {/* Big stat cards */}
        <View style={styles.bigStatsGrid}>
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatValue}>{stats.total_tours}</Text>
            <Text style={styles.bigStatLabel}>Touren</Text>
          </View>
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatValue}>
              {(stats.total_distance_m / 1000).toFixed(0)}
            </Text>
            <Text style={styles.bigStatLabel}>Kilometer</Text>
          </View>
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatValue}>
              {Math.round(stats.total_elevation_gain_m).toLocaleString()}
            </Text>
            <Text style={styles.bigStatLabel}>Höhenmeter</Text>
          </View>
          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatValue}>
              {formatDuration(stats.total_duration_seconds)}
            </Text>
            <Text style={styles.bigStatLabel}>Stunden</Text>
          </View>
        </View>

        {/* Highlights */}
        {mostActiveMonth && (
          <View style={styles.highlightCard}>
            <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            <Text style={styles.highlightText}>
              Dein aktivster Monat war{' '}
              <Text style={styles.highlightBold}>
                {MONTHS[mostActiveMonth.month - 1]}
              </Text>{' '}
              mit {mostActiveMonth.tours} Touren
            </Text>
          </View>
        )}

        <View style={styles.highlightCard}>
          <Ionicons name="trending-up-outline" size={20} color={Colors.primary} />
          <Text style={styles.highlightText}>
            Du bist durchschnittlich{' '}
            <Text style={styles.highlightBold}>
              {(stats.avg_distance_m / 1000).toFixed(1)} km
            </Text>{' '}
            pro Tour gewandert
          </Text>
        </View>

        {/* Action buttons */}
        <Pressable
          style={styles.actionButton}
          onPress={() => Alert.alert('Teilen', 'Teilen-Funktion kommt bald!')}
        >
          <Ionicons name="share-social-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Im Feed teilen</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            Alert.alert('Speichern', 'Als Bild speichern kommt bald!')
          }
        >
          <Ionicons name="image-outline" size={20} color={Colors.primary} />
          <Text style={styles.secondaryButtonText}>Als Bild speichern</Text>
        </Pressable>
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
    paddingBottom: 40,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 48,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  bigStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
    width: '100%',
  },
  bigStatCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  bigStatValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
  },
  bigStatLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    width: '100%',
  },
  highlightText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  highlightBold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    width: '100%',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
    width: '100%',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  premiumBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
  },
  premiumSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
