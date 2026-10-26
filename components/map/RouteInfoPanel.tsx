import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, SAC_SCALES } from '../../constants';
import type { SACScale } from '../../types';

interface RouteInfo {
  distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  estimated_duration_min: number;
  sac_scale: SACScale | null;
  max_elevation_m: number | null;
}

interface RouteInfoPanelProps {
  route: RouteInfo;
  onSave: () => void;
  onShowElevation: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')} h` : `${m} min`;
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

export function RouteInfoPanel({
  route,
  onSave,
  onShowElevation,
  isSaving = false,
  isSaved = false,
}: RouteInfoPanelProps) {
  const sacInfo = route.sac_scale ? SAC_SCALES[route.sac_scale] : null;

  return (
    <View style={styles.container}>
      {/* SAC Badge */}
      {sacInfo && (
        <View style={[styles.sacBadge, { backgroundColor: sacInfo.color }]}>
          <Text style={styles.sacText}>{sacInfo.label}</Text>
        </View>
      )}

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
          <Text style={styles.statValue}>{formatDistance(route.distance_m)}</Text>
          <Text style={styles.statLabel}>Distanz</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={18} color={Colors.primary} />
          <Text style={styles.statValue}>
            {formatDuration(route.estimated_duration_min)}
          </Text>
          <Text style={styles.statLabel}>Dauer</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="arrow-up-outline" size={18} color={Colors.success} />
          <Text style={styles.statValue}>{Math.round(route.elevation_gain_m)} m</Text>
          <Text style={styles.statLabel}>Aufstieg</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="arrow-down-outline" size={18} color={Colors.error} />
          <Text style={styles.statValue}>{Math.round(route.elevation_loss_m)} m</Text>
          <Text style={styles.statLabel}>Abstieg</Text>
        </View>
      </View>

      {/* Max Elevation */}
      {route.max_elevation_m != null && (
        <View style={styles.maxElevRow}>
          <Ionicons name="triangle-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.maxElevText}>
            Max. Höhe: {Math.round(route.max_elevation_m)} m ü.M.
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.elevationButton]}
          onPress={onShowElevation}
        >
          <Ionicons name="analytics-outline" size={18} color={Colors.primary} />
          <Text style={styles.elevationButtonText}>Höhenprofil</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.saveButton, isSaved && styles.saveButtonDone]}
          onPress={onSave}
          disabled={isSaving || isSaved}
          accessibilityState={{ disabled: isSaving || isSaved, busy: isSaving }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.surface} />
          ) : (
            <>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={Colors.surface}
              />
              <Text style={styles.saveButtonText}>
                {isSaved ? 'Gespeichert ✓' : 'Route speichern'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  sacBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 14,
  },
  sacText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  maxElevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    marginBottom: 14,
  },
  maxElevText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  elevationButton: {
    backgroundColor: Colors.surfaceVariant,
  },
  elevationButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonDone: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
});
