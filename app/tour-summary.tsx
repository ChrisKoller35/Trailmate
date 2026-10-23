import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { showErrorToast, showInfoToast } from '../lib/toast';
import { confirmAction } from '../lib/dialog';
import { Ionicons } from '@expo/vector-icons';
import {
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
  mapLibreAvailable,
} from '../lib/maplibre';
import { TrailMap } from '../components/map/TrailMap';
import * as Sharing from 'expo-sharing';
import { Colors } from '../constants';
import { useRecordingStore } from '../stores/recordingStore';
import { useAuthStore } from '../stores/authStore';
import { formatDuration, formatDistance } from '../lib/trackingCalculations';
import { exportRecordingAsGPX } from '../lib/gpxExport';
import { ElevationProfile } from '../components/map/ElevationProfile';
import { buildTourShareText, formatSwissNumber } from '../lib/tourShareText';
import { useSaveRecording } from '../hooks/useSaveRecording';

import { SWISSTOPO_STYLE_JSON } from '../lib/mapStyle';

function computeBounds(points: { longitude: number; latitude: number }[]) {
  if (points.length === 0) return null;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  for (const p of points) {
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
  }
  return {
    ne: [maxLng, maxLat] as [number, number],
    sw: [minLng, minLat] as [number, number],
  };
}

export default function TourSummaryScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const { saveRecording, isSaving } = useSaveRecording();
  const savingRef = useRef(false);

  const trackPoints = useRecordingStore((s) => s.trackPoints);
  const currentStats = useRecordingStore((s) => s.currentStats);
  const startedAt = useRecordingStore((s) => s.startedAt);
  const totalPauseDuration = useRecordingStore((s) => s.totalPauseDuration);
  const reset = useRecordingStore((s) => s.reset);

  const profile = useAuthStore((s) => s.profile);
  const isPremium = profile?.is_premium ?? false;

  const pauseSeconds = Math.floor(totalPauseDuration / 1000);
  const movingSeconds = Math.max(0, currentStats.duration - pauseSeconds);

  // Build GeoJSON for map preview
  const trackGeoJSON = React.useMemo(() => {
    if (trackPoints.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: trackPoints.map((p) => [p.longitude, p.latitude]),
      },
    };
  }, [trackPoints]);

  const bounds = React.useMemo(() => computeBounds(trackPoints), [trackPoints]);

  // Speichert die Tour einmal; ein zweiter Tipp während des Speicherns wird ignoriert.
  const saveOnce = useCallback(async () => {
    if (savingRef.current) return null;
    savingRef.current = true;
    try {
      return await saveRecording({
        title,
        stats: currentStats,
        movingSeconds,
        startedAt,
        trackPoints,
      });
    } finally {
      savingRef.current = false;
    }
  }, [saveRecording, title, currentStats, movingSeconds, startedAt, trackPoints]);

  const handleSave = useCallback(async () => {
    const recordingId = await saveOnce();
    if (recordingId) router.replace('/(tabs)/record');
  }, [saveOnce, router]);

  const handleExportGPX = useCallback(async () => {
    if (!isPremium) {
      showInfoToast('Der GPX-Export ist nur für Premium-Mitglieder verfügbar.');
      return;
    }
    if (trackPoints.length === 0) {
      showErrorToast('Keine GPS-Daten zum Exportieren vorhanden.');
      return;
    }

    setIsExporting(true);
    try {
      const gpxTitle = title.trim() || 'TrailMate Tour';
      const fileUri = await exportRecordingAsGPX(trackPoints, gpxTitle);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/gpx+xml',
          dialogTitle: 'GPX exportieren',
        });
      } else {
        showErrorToast('Teilen ist auf diesem Gerät nicht verfügbar.');
      }
    } catch {
      showErrorToast('GPX-Export fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsExporting(false);
    }
  }, [trackPoints, title]);

  const handleDiscard = useCallback(async () => {
    const ok = await confirmAction({
      title: 'Tour verwerfen?',
      message: 'Deine aufgezeichneten Daten werden unwiderruflich gelöscht.',
      confirmText: 'Verwerfen',
      destructive: true,
    });
    if (!ok) return;
    reset();
    router.replace('/(tabs)/record');
  }, [reset, router]);

  const handleShareFeed = useCallback(async () => {
    // Text vor dem Speichern bauen – danach ist der Aufzeichnungs-Speicher leer.
    const text = buildTourShareText({
      title,
      distanceM: currentStats.distance,
      elevationGainM: currentStats.elevationGain,
      durationSeconds: currentStats.duration,
      movingSeconds,
    });
    const recordingId = await saveOnce();
    if (recordingId) router.replace({ pathname: '/create-post', params: { text } });
  }, [title, currentStats, movingSeconds, saveOnce, router]);

  const stats = [
    {
      icon: 'resize-outline' as const,
      label: 'Distanz',
      value: formatDistance(currentStats.distance),
    },
    {
      icon: 'arrow-up-outline' as const,
      label: 'Aufstieg',
      value: `${formatSwissNumber(currentStats.elevationGain)} m`,
    },
    {
      icon: 'arrow-down-outline' as const,
      label: 'Abstieg',
      value: `${formatSwissNumber(currentStats.elevationLoss)} m`,
    },
    {
      icon: 'time-outline' as const,
      label: 'Gesamtzeit',
      value: formatDuration(currentStats.duration),
    },
    {
      icon: 'walk-outline' as const,
      label: 'Gehzeit',
      value: formatDuration(movingSeconds),
    },
    {
      icon: 'pause-outline' as const,
      label: 'Pausenzeit',
      value: formatDuration(pauseSeconds),
    },
    {
      icon: 'speedometer-outline' as const,
      label: 'Ø Geschwindigkeit',
      value: `${currentStats.avgSpeed.toFixed(1)} km/h`,
    },
    {
      icon: 'footsteps-outline' as const,
      label: 'Schritte',
      value:
        currentStats.steps > 0
          ? formatSwissNumber(currentStats.steps)
          : '–',
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Tour Zusammenfassung',
          headerBackTitle: 'Zurück',
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Map preview */}
        <View style={styles.mapContainer}>
          {trackGeoJSON ? (
            Platform.OS === 'web' || !mapLibreAvailable ? (
              <TrailMap
                style={styles.map}
                routeGeoJSON={trackGeoJSON}
              />
            ) : (
            <MapView
              style={styles.map}
              mapStyle={SWISSTOPO_STYLE_JSON}
              logoEnabled={false}
              attributionEnabled={false}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Camera
                defaultSettings={{
                  centerCoordinate: [8.2275, 46.8182],
                  zoomLevel: 8,
                }}
                bounds={
                  bounds
                    ? {
                        ne: bounds.ne,
                        sw: bounds.sw,
                        paddingLeft: 40,
                        paddingRight: 40,
                        paddingTop: 40,
                        paddingBottom: 40,
                      }
                    : undefined
                }
              />
              <ShapeSource id="summary-track" shape={trackGeoJSON}>
                <LineLayer
                  id="summary-line"
                  style={{
                    lineColor: '#FF6B35',
                    lineWidth: 4,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </ShapeSource>
            </MapView>
            )
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons
                name="map-outline"
                size={40}
                color={Colors.textLight}
              />
              <Text style={styles.mapPlaceholderText}>
                Keine Trackdaten vorhanden
              </Text>
            </View>
          )}
        </View>

        {/* Stats grid */}
        <View style={styles.statsCard}>
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={[
                styles.statRow,
                index < stats.length - 1 && styles.statRowBorder,
              ]}
            >
              <View style={styles.statLeft}>
                <Ionicons
                  name={stat.icon}
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Elevation Profile */}
        {trackPoints.length >= 2 && (
          <View style={styles.elevationCard}>
            <Text style={styles.elevationTitle}>Höhenprofil</Text>
            <ElevationProfile
              data={trackPoints.reduce<{ distance: number; elevation: number }[]>(
                (acc, p, i) => {
                  if (p.altitude == null) return acc;
                  const prevDist = acc.length > 0 ? acc[acc.length - 1].distance : 0;
                  if (i === 0) {
                    acc.push({ distance: 0, elevation: p.altitude });
                  } else {
                    const prev = trackPoints[i - 1];
                    const dx = Math.abs(p.longitude - prev.longitude) * 111320 * Math.cos((p.latitude * Math.PI) / 180);
                    const dy = Math.abs(p.latitude - prev.latitude) * 110540;
                    const segDist = Math.sqrt(dx * dx + dy * dy);
                    acc.push({ distance: prevDist + segDist, elevation: p.altitude });
                  }
                  return acc;
                },
                [],
              )}
              width={340}
              height={160}
            />
          </View>
        )}

        {/* Title input */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Titel</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Meine Tour"
            placeholderTextColor={Colors.textLight}
            maxLength={100}
            returnKeyType="done"
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.shareButton,
              pressed && styles.buttonPressed,
              isSaving && styles.buttonDisabled,
            ]}
            onPress={handleShareFeed}
            disabled={isSaving}
          >
            <Ionicons
              name="share-social-outline"
              size={20}
              color={Colors.textSecondary}
            />
            <Text style={styles.shareButtonText}>Im Feed teilen</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.saveButton,
              pressed && styles.buttonPressed,
              isSaving && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={20}
                  color={Colors.textOnPrimary}
                />
                <Text style={styles.saveButtonText}>Speichern</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.exportButton,
              pressed && styles.buttonPressed,
              isExporting && styles.buttonDisabled,
            ]}
            onPress={handleExportGPX}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Ionicons
                  name="document-outline"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.exportButtonText}>GPX exportieren</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.discardButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleDiscard}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
            <Text style={styles.discardButtonText}>Verwerfen</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  mapContainer: {
    height: 200,
    backgroundColor: Colors.surfaceVariant,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  statsCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: Colors.surface,
    borderRadius: 16,
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
  elevationCard: {
    margin: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
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
  elevationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  inputCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: Colors.surfaceVariant,
  },
  actions: {
    paddingHorizontal: 16,
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  shareButton: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  exportButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 6,
    marginTop: 4,
  },
  discardButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
});
