import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
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

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function RecordScreen() {
  const router = useRouter();
  const cameraRef = useRef<any>(null);
  const { requestTrackingPermissions } = usePermissions();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const status = useRecordingStore((s) => s.status);
  const trackPoints = useRecordingStore((s) => s.trackPoints);
  const startedAt = useRecordingStore((s) => s.startedAt);
  const totalPauseDuration = useRecordingStore((s) => s.totalPauseDuration);
  const pausedAt = useRecordingStore((s) => s.pausedAt);
  const currentStats = useRecordingStore((s) => s.currentStats);

  const startRecording = useRecordingStore((s) => s.startRecording);
  const pauseRecording = useRecordingStore((s) => s.pauseRecording);
  const resumeRecording = useRecordingStore((s) => s.resumeRecording);
  const stopRecordingAction = useRecordingStore((s) => s.stopRecording);

  // Request permissions on mount + check for crash recovery
  useEffect(() => {
    requestTrackingPermissions().then((granted) => {
      setPermissionGranted(granted);
    });

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
  }, [router, requestTrackingPermissions]);

  // Pedometer for step counting
  useEffect(() => {
    if (status !== 'recording') return;
    let subscription: { remove: () => void } | null = null;
    const setSteps = useRecordingStore.getState().setSteps;
    Pedometer.isAvailableAsync().then((available) => {
      if (!available) return;
      subscription = Pedometer.watchStepCount((result) => {
        setSteps(result.steps);
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
    if (!permissionGranted) {
      const granted = await requestTrackingPermissions();
      if (!granted) return;
      setPermissionGranted(true);
    }
    startRecording();
    const result = await startTracking();
    if (!result.success) {
      // GPS could not be started – reset recording state
      useRecordingStore.getState().reset();
      showErrorToast(result.error ?? 'GPS konnte nicht gestartet werden.');
    }
  }, [permissionGranted, startRecording, requestTrackingPermissions]);

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
          routeGeoJSON={trackGeoJSON}
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
