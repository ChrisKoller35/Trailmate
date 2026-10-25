import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pedometer } from 'expo-sensors';
import {
  MapView,
  Camera,
  UserLocation,
  ShapeSource,
  LineLayer,
  mapLibreAvailable,
} from '../../lib/maplibre';
import { TrailMap } from '../../components/map/TrailMap';
import { Colors } from '../../constants';
import { useRecordingStore } from '../../stores/recordingStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useLiveLocationSync } from '../../hooks/useLiveLocationSync';
import {
  startTracking,
  stopTracking,
  setTrackingAccuracy,
} from '../../lib/trackingService';
import {
  formatDistance,
  applyTrailingDriftCorrection,
} from '../../lib/trackingCalculations';
import { setActiveRecordingId, getActiveRecordingId } from '../../lib/trackPointStorage';
import { SWISSTOPO_STYLE_JSON } from '../../lib/mapStyle';
import { chooseAction, confirmAction } from '../../lib/dialog';
import { showErrorToast, showInfoToast } from '../../lib/toast';
import { normalizeRouteId } from '../../lib/routeId';
import { totalSteps } from '../../lib/stepCounter';
import { lineBounds } from '../../lib/geoBounds';
import { useRouteGeometry } from '../../hooks/useRouteGeometry';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function RecordScreen() {
  const router = useRouter();
  // Gesetzt, wenn «Navigation starten» in route-detail die Aufnahme öffnet
  const { routeId } = useLocalSearchParams<{ routeId?: string | string[] }>();
  const cameraRef = useRef<any>(null);
  const { requestLocationPermission, requestTrackingPermissions } = usePermissions();
  const mountedRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const status = useRecordingStore((s) => s.status);
  const trackPoints = useRecordingStore((s) => s.trackPoints);
  const startedAt = useRecordingStore((s) => s.startedAt);
  const totalPauseDuration = useRecordingStore((s) => s.totalPauseDuration);
  const pausedAt = useRecordingStore((s) => s.pausedAt);
  const currentStats = useRecordingStore((s) => s.currentStats);
  const recordingRouteId = useRecordingStore((s) => s.routeId);

  const startRecording = useRecordingStore((s) => s.startRecording);
  const pauseRecording = useRecordingStore((s) => s.pauseRecording);
  const resumeRecording = useRecordingStore((s) => s.resumeRecording);
  const stopRecordingAction = useRecordingStore((s) => s.stopRecording);
  const { isSharing: isLiveSharing } = useLiveLocationSync();

  // Beim Öffnen nur den Standort im Vordergrund fragen + unfertige Tour suchen.
  // usePermissions liefert bei jedem Rendern neue Funktionen; der Merker
  // sorgt dafür, dass das nur einmal läuft.
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    void requestLocationPermission();

    // Check for unfinished recording (crash recovery)
    getActiveRecordingId().then(async (activeId) => {
      if (!activeId || useRecordingStore.getState().status !== 'idle') return;
      const choice = await chooseAction(
        'Unfertige Tour gefunden',
        [
          { label: 'Wiederherstellen', value: 'recover' },
          { label: 'Verwerfen', value: 'discard', destructive: true },
        ],
        'Es wurde eine nicht abgeschlossene Aufzeichnung gefunden. Möchtest du sie wiederherstellen?',
      );
      if (choice === 'discard') {
        await setActiveRecordingId(null);
      } else if (choice === 'recover') {
        await useRecordingStore.getState().recoverFromCrash(activeId);
        router.push('/tour-summary');
      }
    });
  }, [router, requestLocationPermission]);

  // Pedometer for step counting
  useEffect(() => {
    if (status !== 'recording') return;
    let subscription: { remove: () => void } | null = null;
    const { setSteps, currentStats } = useRecordingStore.getState();
    // Das Abo zählt ab 0; Schritte vor einer Pause bleiben als Basis erhalten
    const stepsBefore = currentStats.steps;
    Pedometer.isAvailableAsync().then((available) => {
      if (!available) return;
      subscription = Pedometer.watchStepCount((result) => {
        setSteps(totalSteps(stepsBefore, result.steps));
      });
    });
    return () => {
      subscription?.remove();
    };
  }, [status]);

  // Timer for elapsed time
  useEffect(() => {
    if (status === 'recording' && startedAt) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const totalMs = now - startedAt - totalPauseDuration;
        setElapsed(Math.max(0, Math.floor(totalMs / 1000)));
      }, 1000);
    } else if (status === 'paused' && startedAt && pausedAt) {
      // When paused, show frozen time
      const totalMs = pausedAt - startedAt - totalPauseDuration;
      setElapsed(Math.max(0, Math.floor(totalMs / 1000)));
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (status === 'idle') setElapsed(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, startedAt, totalPauseDuration, pausedAt]);

  // Build track GeoJSON
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

  // Geplante Route: vor dem Start aus dem Parameter, danach aus dem Store
  const plannedRouteId = status === 'idle' ? normalizeRouteId(routeId) : recordingRouteId;
  const plannedRoute = useRouteGeometry(plannedRouteId);
  const fittedRouteRef = useRef<typeof plannedRoute>(null);

  // Solange keine Aufnahme läuft, einmal auf die geplante Route ausrichten
  useEffect(() => {
    if (status !== 'idle' || !plannedRoute || fittedRouteRef.current === plannedRoute) return;
    const bounds = lineBounds(plannedRoute.geometry.coordinates);
    if (!bounds || !cameraRef.current) return;
    fittedRouteRef.current = plannedRoute;
    cameraRef.current.fitBounds(bounds.ne, bounds.sw, 40, 500);
  }, [plannedRoute, status]);

  // Follow user when recording
  useEffect(() => {
    if (
      (status === 'recording') &&
      trackPoints.length > 0 &&
      cameraRef.current
    ) {
      const last = trackPoints[trackPoints.length - 1];
      cameraRef.current.setCamera({
        centerCoordinate: [last.longitude, last.latitude],
        zoomLevel: 15,
        animationDuration: 500,
      });
    }
  }, [trackPoints.length, status]);

  const handleStart = useCallback(async () => {
    // Hintergrund-Standort erst hier; die Funktion prüft selbst, ob er schon erlaubt ist
    const granted = await requestTrackingPermissions();
    if (!granted) return;
    startRecording(normalizeRouteId(routeId));
    // Parameter leeren, damit eine spätere freie Aufzeichnung über den Tab
    // nicht an der alten Route hängt
    if (routeId) router.setParams({ routeId: '' });
    const result = await startTracking();
    if (!result.success) {
      // GPS could not be started – reset recording state
      useRecordingStore.getState().reset();
      showErrorToast(result.error ?? 'GPS konnte nicht gestartet werden.');
    }
  }, [startRecording,requestTrackingPermissions, routeId, router]);

  const handlePause = useCallback(async () => {
    pauseRecording();
    await setTrackingAccuracy('low');
  }, [pauseRecording]);

  const handleResume = useCallback(async () => {
    resumeRecording();
    await setTrackingAccuracy('high');
  }, [resumeRecording]);

  const handleStop = useCallback(async () => {
    const ok = await confirmAction({
      title: 'Tour beenden?',
      message: 'Möchtest du die aktuelle Aufzeichnung beenden?',
      confirmText: 'Beenden',
      destructive: true,
    });
    if (!ok) return;
    await stopTracking();
    const store = useRecordingStore.getState();
    const points = store.trackPoints;
    if (points.length === 0) {
      store.reset();
      await setActiveRecordingId(null);
      showInfoToast('Es wurden keine GPS-Punkte aufgezeichnet.');
      return;
    }
    // Apply trailing drift correction
    const corrected = applyTrailingDriftCorrection(points);
    useRecordingStore.setState({ trackPoints: corrected });
    stopRecordingAction();
    await setActiveRecordingId(null);
    router.push('/tour-summary');
  }, [stopRecordingAction, router]);

  const isActive = status === 'recording' || status === 'paused';

  const renderMap = () => {
    if (Platform.OS === 'web' || !mapLibreAvailable) {
      return (
        <TrailMap
          style={styles.map}
          routeGeoJSON={trackGeoJSON ?? plannedRoute}
        />
      );
    }
    return (
      <MapView
        style={styles.map}
        mapStyle={SWISSTOPO_STYLE_JSON}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [8.2275, 46.8182],
            zoomLevel: 8,
          }}
        />
        <UserLocation visible />

        {/* Vor der Aufzeichnung im JSX, damit die Linie darunter liegt */}
        {plannedRoute && (
          <ShapeSource id="planned-route" shape={plannedRoute}>
            <LineLayer
              id="planned-route-line"
              style={{
                lineColor: Colors.primary,
                lineWidth: 4,
                lineDasharray: [2, 2],
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}

        {trackGeoJSON && (
          <ShapeSource id="recording-track" shape={trackGeoJSON}>
            <LineLayer
              id="recording-line"
              style={{
                lineColor: '#FF6B35',
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}
      </MapView>
    );
  };

  return (
    <View style={styles.container}>
      {renderMap()}

      {/* Recording indicator overlay */}
      {isActive && (
        <SafeAreaView style={[styles.recIndicatorContainer, { pointerEvents: 'none' }]}>
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>
              {status === 'paused' ? 'PAUSE' : 'REC'}
            </Text>
            <Text style={styles.recTime}>{formatElapsed(elapsed)}</Text>
          </View>
          {isLiveSharing && (
            <View style={styles.liveBadge}>
              <Ionicons name="radio" size={14} color={Colors.textOnPrimary} />
              <Text style={styles.liveText}>Live geteilt</Text>
            </View>
          )}
        </SafeAreaView>
      )}

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {status === 'idle' && (
          <View style={styles.idlePanel}>
            <Text style={styles.idleTitle}>Bereit für eine Tour?</Text>
            <Text style={styles.idleSubtitle}>
              Zeichne deine Wanderung auf und verfolge deine Statistiken
            </Text>
            {/* Im Browser gibt es kein Hintergrund-GPS (expo-task-manager) */}
            {Platform.OS === 'web' ? (
              <Text style={styles.webHint}>
                Aufzeichnen geht nur in der TrailMate-App auf dem Handy.
              </Text>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.startButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleStart}
              >
                <Ionicons name="play" size={24} color={Colors.textOnPrimary} />
                <Text style={styles.startButtonText}>Tour starten</Text>
              </Pressable>
            )}
          </View>
        )}

        {isActive && (
          <View style={styles.activePanel}>
            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Distanz</Text>
                <Text style={styles.statValue}>
                  {formatDistance(currentStats.distance)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>↑ Aufstieg</Text>
                <Text style={styles.statValue}>
                  {Math.round(currentStats.elevationGain)} m
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>↓ Abstieg</Text>
                <Text style={styles.statValue}>
                  {Math.round(currentStats.elevationLoss)} m
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Ø Tempo</Text>
                <Text style={styles.statValue}>
                  {currentStats.avgSpeed.toFixed(1)} km/h
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              {status === 'paused' ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.resumeButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleResume}
                >
                  <Ionicons
                    name="play"
                    size={22}
                    color={Colors.textOnPrimary}
                  />
                  <Text style={styles.actionButtonText}>Fortsetzen</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.pauseButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handlePause}
                >
                  <Ionicons
                    name="pause"
                    size={22}
                    color={Colors.textOnPrimary}
                  />
                  <Text style={styles.actionButtonText}>Pause</Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.stopButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleStop}
              >
                <Ionicons
                  name="stop"
                  size={22}
                  color={Colors.textOnPrimary}
                />
                <Text style={styles.actionButtonText}>Beenden</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    flex: 1,
  },
  recIndicatorContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 0 : 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginTop: Platform.OS === 'ios' ? 8 : 0,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginTop: 6,
  },
  liveText: {
    color: Colors.textOnPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
  },
  recText: {
    color: Colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  recTime: {
    color: Colors.textOnPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  idlePanel: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    alignItems: 'center',
  },
  idleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  idleSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 32,
    gap: 10,
    width: '100%',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  webHint: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  activePanel: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statItem: {
    width: '50%',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
    gap: 8,
  },
  pauseButton: {
    backgroundColor: Colors.warning,
  },
  resumeButton: {
    backgroundColor: Colors.primaryLight,
  },
  stopButton: {
    backgroundColor: Colors.error,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
