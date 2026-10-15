import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, SAC_SCALES } from '../constants';
import { useRouteBookmarks } from '../hooks/useRouteBookmarks';
import type { Route, SACScale } from '../types';

function formatDistance(meters: number | null): string {
  if (meters == null) return '–';
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '–';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')} h` : `${m} min`;
}

function BookmarkCard({
  route,
  onRemove,
}: {
  route: Route;
  onRemove: () => void;
}) {
  const sac = route.sac_scale ? SAC_SCALES[route.sac_scale as SACScale] : null;

  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({ pathname: '/route-detail', params: { id: route.id } })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {route.title ?? 'Unbenannte Route'}
        </Text>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="bookmark" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.stat}>
          <Ionicons name="navigate-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.statText}>{formatDistance(route.distance_m)}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="arrow-up-outline" size={14} color={Colors.success} />
          <Text style={styles.statText}>
            {route.elevation_gain_m != null
              ? `${Math.round(route.elevation_gain_m)} m`
              : '–'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.statText}>
            {formatDuration(route.estimated_duration_min)}
          </Text>
        </View>
        {sac && (
          <View style={[styles.sacBadge, { backgroundColor: sac.color }]}>
            <Text style={styles.sacText}>{route.sac_scale}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function SavedRoutesScreen() {
  const {
    bookmarkedRoutes,
    isLoading,
    fetchBookmarkedRoutes,
    toggleBookmark,
  } = useRouteBookmarks();

  useEffect(() => {
    fetchBookmarkedRoutes();
  }, [fetchBookmarkedRoutes]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gespeicherte Routen</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={bookmarkedRoutes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BookmarkCard
              route={item}
              onRemove={() => toggleBookmark(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bookmark-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>Keine gespeicherten Routen</Text>
              <Text style={styles.emptyText}>
                Speichere Routen, um sie hier wiederzufinden.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sacBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  sacText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.surface,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
  },
});
