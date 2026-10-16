import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, SAC_SCALES } from '../../constants';
import { useRouteFilter } from '../../hooks/useRouteFilter';
import { RouteFilterSheet } from '../../components/map/RouteFilterSheet';
import type { Route, SACScale } from '../../types';

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

function RouteCard({ route }: { route: Route }) {
  const sac = route.sac_scale ? SAC_SCALES[route.sac_scale as SACScale] : null;

  return (
    <Pressable
      style={styles.routeCard}
      onPress={() => router.push({ pathname: '/route-detail', params: { id: route.id } })}
    >
      <View style={styles.routeCardHeader}>
        <Text style={styles.routeTitle} numberOfLines={1}>
          {route.title ?? 'Unbenannte Route'}
        </Text>
        {sac && (
          <View style={[styles.sacBadge, { backgroundColor: sac.color }]}>
            <Text style={styles.sacBadgeText}>{route.sac_scale}</Text>
          </View>
        )}
      </View>

      {route.description && (
        <Text style={styles.routeDesc} numberOfLines={2}>
          {route.description}
        </Text>
      )}

      <View style={styles.routeStats}>
        <View style={styles.routeStat}>
          <Ionicons name="navigate-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.routeStatText}>
            {formatDistance(route.distance_m)}
          </Text>
        </View>
        <View style={styles.routeStat}>
          <Ionicons name="arrow-up-outline" size={14} color={Colors.success} />
          <Text style={styles.routeStatText}>
            {route.elevation_gain_m != null ? `${Math.round(route.elevation_gain_m)} m` : '–'}
          </Text>
        </View>
        <View style={styles.routeStat}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.routeStatText}>
            {formatDuration(route.estimated_duration_min)}
          </Text>
        </View>
        {route.region && (
          <View style={styles.routeStat}>
            <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.routeStatText}>{route.region}</Text>
          </View>
        )}
      </View>

      {route.is_curated && (
        <View style={styles.curatedBadge}>
          <Ionicons name="star" size={12} color={Colors.secondary} />
          <Text style={styles.curatedText}>Top-Tour</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const { routes, isLoading, fetchFilteredRoutes, sacScales } = useRouteFilter();

  useEffect(() => {
    // Wait for Zustand persist middleware to hydrate filter state from AsyncStorage
    const timer = setTimeout(() => {
      fetchFilteredRoutes();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const filteredRoutes = searchQuery.trim()
    ? routes.filter(
        (r) =>
          r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.region?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : routes;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Entdecken</Text>
        <Text style={styles.headerSubtitle}>Touren & Routen</Text>
      </View>

      {/* Search + Filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Route suchen..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[
            styles.filterButton,
            sacScales.length > 0 && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilter(true)}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={sacScales.length > 0 ? Colors.surface : Colors.primary}
          />
        </Pressable>
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Routen laden...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRoutes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RouteCard route={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="trail-sign-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>Keine Routen gefunden</Text>
              <Text style={styles.emptyText}>
                Passe deine Filter an oder suche nach anderen Begriffen.
              </Text>
            </View>
          }
        />
      )}

      {/* Filter Sheet */}
      <RouteFilterSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={() => {
          fetchFilteredRoutes();
          setShowFilter(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: Colors.surface,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  routeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  routeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  sacBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sacBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.surface,
  },
  routeDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  routeStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  routeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeStatText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  curatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  curatedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
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
    maxWidth: 260,
  },
});
