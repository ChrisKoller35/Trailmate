import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { useAuthStore } from '../stores/authStore';
import { useStats, useMonthlyActivity, usePersonalRecords, useYearComparison } from '../hooks/useStats';

type StatsPeriod = 'week' | 'month' | 'season' | 'year' | 'all';

const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: 'week', label: 'Woche' },
  { key: 'month', label: 'Monat' },
  { key: 'season', label: 'Saison' },
  { key: 'year', label: 'Jahr' },
  { key: 'all', label: 'Gesamt' },
];

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')} h`;
}

function DiffBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <Text style={[styles.diffBadge, { color: positive ? Colors.success : Colors.error }]}>
      {positive ? '+' : ''}{value}% vs Vorjahr
    </Text>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);
  const isPremium = profile?.is_premium ?? false;

  const [period, setPeriod] = useState<StatsPeriod>('month');
  const currentYear = new Date().getFullYear();

  const { data: stats, isLoading } = useStats(userId, period);
  const { data: monthly } = useMonthlyActivity(userId, currentYear);
  const { data: records } = usePersonalRecords(userId);
  const { data: comparison } = useYearComparison(userId);

  const maxTours = Math.max(...(monthly ?? []).map((m) => m.tours), 1);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Statistiken' }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Period selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}
        >
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              style={[styles.periodButton, period === p.key && styles.periodButtonActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text
                style={[
                  styles.periodText,
                  period === p.key && styles.periodTextActive,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Stats grid */}
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 32 }} />
        ) : stats ? (
          <View style={styles.statsGrid}>
            <StatCard
              icon="walk-outline"
              label="Touren"
              value={String(stats.total_tours)}
            />
            <StatCard
              icon="navigate-outline"
              label="Distanz"
              value={`${(stats.total_distance_m / 1000).toFixed(1)} km`}
            />
            <StatCard
              icon="arrow-up-outline"
              label="Höhenmeter"
              value={`${Math.round(stats.total_elevation_gain_m)} hm`}
            />
            <StatCard
              icon="time-outline"
              label="Dauer"
              value={formatDuration(stats.total_duration_seconds)}
            />
          </View>
        ) : null}

        {/* Year comparison (Premium) */}
        {isPremium && comparison && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Jahresvergleich</Text>
            <View style={styles.comparisonRow}>
              <CompareItem label="Touren" diff={comparison.toursDiff} />
              <CompareItem label="Distanz" diff={comparison.distanceDiff} />
              <CompareItem label="Höhenmeter" diff={comparison.elevationDiff} />
            </View>
          </View>
        )}

        {/* Monthly activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monatsaktivität {currentYear}</Text>
          <View style={styles.chartContainer}>
            {(monthly ?? []).map((m) => (
              <View key={m.month} style={styles.barCol}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max((m.tours / maxTours) * 100, 4),
                    },
                  ]}
                />
                <Text style={styles.barLabel}>{MONTHS[m.month - 1]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Personal records (Premium) */}
        {isPremium && records && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Persönliche Rekorde</Text>
            <RecordRow icon="resize-outline" label="Längste Tour" value={`${records.longest_tour_km.toFixed(1)} km`} />
            <RecordRow icon="arrow-up" label="Meiste Höhenmeter" value={`${Math.round(records.highest_elevation_m)} hm`} />
            <RecordRow icon="timer-outline" label="Längste Dauer" value={`${records.longest_duration_h.toFixed(1)} h`} />
            <RecordRow icon="footsteps-outline" label="Meiste Schritte" value={String(records.most_steps)} />
            <RecordRow icon="speedometer-outline" label="Schnellster Schnitt" value={`${records.fastest_avg_speed.toFixed(1)} km/h`} />
          </View>
        )}

        {/* Year review button (Premium) */}
        {isPremium ? (
          <Pressable
            style={styles.yearReviewButton}
            onPress={() => router.push('/year-review')}
          >
            <Text style={styles.yearReviewEmoji}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.yearReviewTitle}>Jahresrückblick {currentYear}</Text>
              <Text style={styles.yearReviewSubtitle}>Dein Wanderjahr in Zahlen</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={styles.premiumBanner}>
            <Ionicons name="lock-closed" size={20} color={Colors.warning} />
            <Text style={styles.premiumText}>
              Jahresrückblick, Rekorde & Vergleich mit Premium freischalten
            </Text>
          </View>
        )}

        {/* Heatmap placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Heatmap</Text>
          <View style={styles.placeholder}>
            <Ionicons name="map-outline" size={32} color={Colors.textLight} />
            <Text style={styles.placeholderText}>Heatmap coming soon</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={22} color={Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CompareItem({ label, diff }: { label: string; diff: number }) {
  return (
    <View style={styles.compareItem}>
      <Text style={styles.compareLabel}>{label}</Text>
      <DiffBadge value={diff} />
    </View>
  );
}

function RecordRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.recordRow}>
      <Ionicons name={icon as any} size={18} color={Colors.primary} style={{ marginRight: 10 }} />
      <Text style={styles.recordLabel}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceVariant,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  periodTextActive: {
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  compareItem: {
    alignItems: 'center',
    gap: 4,
  },
  compareLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  diffBadge: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    height: 160,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 14,
    backgroundColor: Colors.primaryLight,
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  recordLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  recordValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  yearReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  yearReviewEmoji: {
    fontSize: 28,
  },
  yearReviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  yearReviewSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  premiumText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  placeholder: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.textLight,
  },
});
