import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Recording } from '../types';

function formatDistance(meters: number | null): string {
  if (meters == null) return '–';
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds == null) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function RecordingHistoryScreen() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecordings = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (fetchError) {
        setError('Touren konnten nicht geladen werden.');
        return;
      }

      setRecordings((data as Recording[]) ?? []);
    } catch {
      setError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const renderItem = useCallback(
    ({ item }: { item: Recording }) => (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
      >
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title || 'Unbenannte Tour'}
        </Text>
        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Ionicons
              name="resize-outline"
              size={14}
              color={Colors.textSecondary}
            />
            <Text style={styles.cardStatText}>
              {formatDistance(item.distance_m)}
            </Text>
          </View>
          <View style={styles.cardStat}>
            <Ionicons
              name="arrow-up-outline"
              size={14}
              color={Colors.textSecondary}
            />
            <Text style={styles.cardStatText}>
              {item.elevation_gain_m != null
                ? `${Math.round(item.elevation_gain_m)}m`
                : '–'}
            </Text>
          </View>
          <View style={styles.cardStat}>
            <Ionicons
              name="time-outline"
              size={14}
              color={Colors.textSecondary}
            />
            <Text style={styles.cardStatText}>
              {formatDurationSeconds(item.duration_seconds)}
            </Text>
          </View>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.started_at)}</Text>
      </Pressable>
    ),
    [],
  );

  const keyExtractor = useCallback((item: Recording) => item.id, []);

  const ListEmptyComponent = useCallback(() => {
    if (isLoading) return null;
    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={Colors.textLight}
          />
          <Text style={styles.emptyTitle}>{error}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={() => {
              setIsLoading(true);
              fetchRecordings();
            }}
          >
            <Text style={styles.retryButtonText}>Erneut versuchen</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="footsteps-outline"
          size={48}
          color={Colors.textLight}
        />
        <Text style={styles.emptyTitle}>Noch keine Touren aufgezeichnet</Text>
        <Text style={styles.emptySubtitle}>
          Starte deine erste Tour im Aufnehmen-Tab
        </Text>
      </View>
    );
  }, [isLoading, error, fetchRecordings]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Meine Touren',
          headerBackTitle: 'Zurück',
        }}
      />
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={recordings}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={ListEmptyComponent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    flexGrow: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  cardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardStatText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  cardDate: {
    fontSize: 13,
    color: Colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  retryButtonPressed: {
    opacity: 0.85,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
});
