import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, SAC_SCALES } from '../constants';
import { supabase } from '../lib/supabase';
import { DEMO_ROUTES } from '../__fixtures__/demoData';
import { useRouteBookmarks } from '../hooks/useRouteBookmarks';
import { useAuthStore } from '../stores/authStore';
import { exportRouteAsGPX } from '../lib/gpxExport';
import WeatherCard from '../components/weather/WeatherCard';
import TrailConditionCard from '../components/trail/TrailConditionCard';
import TrailConditionReport from '../components/trail/TrailConditionReport';
import TransportCard from '../components/transport/TransportCard';
import type { Route, SACScale } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [endpoints, setEndpoints] = useState<{
    start_lat: number; start_lng: number;
    end_lat: number; end_lng: number;
    center_lat: number; center_lng: number;
  } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [conditionRefreshKey, setConditionRefreshKey] = useState(0);
  const { isBookmarked, toggleBookmark } = useRouteBookmarks();
  const isPremium = useAuthStore((s) => s.profile?.is_premium ?? false);

  useEffect(() => {
    if (!id) return;

    (async () => {
      // Check if this is a demo route first
      const demoRoute = DEMO_ROUTES.find((r) => r.id === id);
      if (demoRoute) {
        setRoute(demoRoute);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        setRoute(data as Route);
      }

      // Fetch route endpoints for weather/transport (ignore errors gracefully)
      try {
        const { data: epData } = await supabase.rpc('get_route_endpoints', { p_route_id: id });
        if (epData && epData.length > 0) {
          setEndpoints(epData[0]);
        }
      } catch {
        // Endpoints not available - weather/transport sections will simply not show
      }

      setIsLoading(false);
    })();
  }, [id]);

  const handleExportGPX = async () => {
    if (!isPremium) {
      Alert.alert('Premium-Funktion', 'GPX-Export ist nur für Premium-Nutzer verfügbar.');
      return;
    }
    if (!route) return;

    try {
      const fileUri = await exportRouteAsGPX(route);
      if (fileUri) {
        await Share.share(
          Platform.OS === 'ios'
            ? { url: fileUri }
            : { message: fileUri, title: `${route.title ?? 'Route'}.gpx` },
        );
      }
    } catch {
      Alert.alert('Fehler', 'GPX-Export fehlgeschlagen.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Route nicht gefunden</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  const sacInfo = route.sac_scale ? SAC_SCALES[route.sac_scale as SACScale] : null;
  const bookmarked = isBookmarked(route.id);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {route.title ?? 'Route'}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => toggleBookmark(route.id)} hitSlop={8}>
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={bookmarked ? Colors.primary : Colors.text}
            />
          </Pressable>
          <Pressable onPress={handleExportGPX} hitSlop={8}>
            <Ionicons name="download-outline" size={22} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* SAC Badge */}
        {sacInfo && (
          <View style={[styles.sacBadge, { backgroundColor: sacInfo.color }]}>
            <Text style={styles.sacBadgeText}>{sacInfo.label}</Text>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="navigate-outline" size={22} color={Colors.primary} />
            <Text style={styles.statValue}>{formatDistance(route.distance_m)}</Text>
            <Text style={styles.statLabel}>Distanz</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={22} color={Colors.primary} />
            <Text style={styles.statValue}>{formatDuration(route.estimated_duration_min)}</Text>
            <Text style={styles.statLabel}>Dauer</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="arrow-up-outline" size={22} color={Colors.success} />
            <Text style={styles.statValue}>
              {route.elevation_gain_m != null ? `${Math.round(route.elevation_gain_m)} m` : '–'}
            </Text>
            <Text style={styles.statLabel}>Aufstieg</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="arrow-down-outline" size={22} color={Colors.error} />
            <Text style={styles.statValue}>
              {route.elevation_loss_m != null ? `${Math.round(route.elevation_loss_m)} m` : '–'}
            </Text>
            <Text style={styles.statLabel}>Abstieg</Text>
          </View>
        </View>

        {/* Max Elevation */}
        {route.max_elevation_m != null && (
          <View style={styles.infoRow}>
            <Ionicons name="triangle-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              Maximale Höhe: {Math.round(route.max_elevation_m)} m ü.M.
            </Text>
          </View>
        )}

        {/* Region */}
        {route.region && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>{route.region}</Text>
          </View>
        )}

        {/* Curated Badge */}
        {route.is_curated && (
          <View style={styles.curatedRow}>
            <Ionicons name="star" size={16} color={Colors.secondary} />
            <Text style={styles.curatedText}>Kuratierte Top-Tour</Text>
          </View>
        )}

        {/* Description */}
        {route.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Beschreibung</Text>
            <Text style={styles.description}>{route.description}</Text>
          </View>
        )}

        {/* Weather */}
        {route.id && endpoints && (
          <View style={styles.section}>
            <WeatherCard
              routeId={route.id}
              lat={endpoints.center_lat}
              lng={endpoints.center_lng}
              elevation={route.max_elevation_m ?? undefined}
            />
          </View>
        )}

        {/* Trail Conditions */}
        {route.id && (
          <View style={styles.section}>
            <TrailConditionCard
              routeId={route.id}
              onOpenReport={() => setShowReportModal(true)}
              refreshKey={conditionRefreshKey}
            />
          </View>
        )}

        {/* Public transport access */}
        {route.id && endpoints && (
          <View style={styles.section}>
            <TransportCard
              routeId={route.id}
              startLat={endpoints.start_lat}
              startLng={endpoints.start_lng}
              endLat={endpoints.end_lat}
              endLng={endpoints.end_lng}
              routeDurationMin={route.estimated_duration_min ?? undefined}
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push({ pathname: '/(tabs)/map', params: { routeId: route.id } })}
          >
            <Ionicons name="map" size={18} color={Colors.surface} />
            <Text style={styles.primaryButtonText}>Auf Karte anzeigen</Text>
          </Pressable>

          <Pressable
            style={styles.navigationButton}
            onPress={() => router.push({ pathname: '/(tabs)/record', params: { routeId: route.id } })}
          >
            <Ionicons name="radio-button-on" size={18} color={Colors.surface} />
            <Text style={styles.navigationButtonText}>Navigation starten</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => toggleBookmark(route.id)}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.secondaryButtonText}>
              {bookmarked ? 'Gespeichert' : 'Merken'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Trail Condition Report Modal */}
      {route.id && (
        <TrailConditionReport
          routeId={route.id}
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          onSubmitted={() => {
            setShowReportModal(false);
            setConditionRefreshKey((k) => k + 1);
          }}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  backBtnText: {
    color: Colors.surface,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sacBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 16,
  },
  sacBadgeText: {
    color: Colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  curatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  curatedText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
  },
  section: {
    marginTop: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.surface,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceVariant,
    paddingVertical: 14,
    borderRadius: 14,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
  },
  navigationButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.surface,
  },
});
