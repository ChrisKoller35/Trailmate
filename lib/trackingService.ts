import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import KalmanFilter from './kalmanFilter';
import { PauseDetector } from './pauseDetection';
import { calculateDistance } from './trackingCalculations';
import { batchAppendTrackPoint } from './trackPointStorage';
import { useRecordingStore } from '../stores/recordingStore';
import type { TrackPoint } from '../types';

const TRACKING_TASK_NAME = 'TRAILMATE_GPS_TRACKING';
const MAX_ACCURACY = 50; // meters
const MIN_DISTANCE_INTERVAL = 10; // meters
const MAX_HIKING_SPEED_MS = 50 / 3.6; // 50 km/h → m/s

const kalmanFilter = new KalmanFilter();
const pauseDetector = new PauseDetector();

let lastPoint: TrackPoint | null = null;

TaskManager.defineTask(TRACKING_TASK_NAME, async ({ data, error }: { data: any; error: any }) => {
  if (error) return;
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const store = useRecordingStore.getState();
  if (store.status !== 'recording' || !store.recordingId) return;

  for (const loc of locations) {
    const { latitude, longitude, altitude, speed, accuracy } = loc.coords;
    const timestamp = loc.timestamp;

    // Filter out inaccurate readings
    if (accuracy != null && accuracy > MAX_ACCURACY) continue;

    // Apply Kalman filter
    const filtered = kalmanFilter.process(latitude, longitude, accuracy ?? 10);

    // Check distance from last point
    if (lastPoint) {
      const dist = calculateDistance(
        lastPoint.latitude,
        lastPoint.longitude,
        filtered.lat,
        filtered.lng
      );
      if (dist < MIN_DISTANCE_INTERVAL) continue;
    }

    // Filter unrealistic speed
    if (speed != null && speed > MAX_HIKING_SPEED_MS) continue;

    // Check automatic pause
    const isPause = pauseDetector.checkPause(speed, accuracy);

    const point: TrackPoint = {
      latitude: filtered.lat,
      longitude: filtered.lng,
      altitude: altitude ?? null,
      timestamp,
      speed: speed ?? null,
      accuracy: accuracy ?? null,
      isPause,
    };

    lastPoint = point;
    store.addPoint(point);
    batchAppendTrackPoint(store.recordingId, point);
  }
});

export async function startTracking(): Promise<{ success: boolean; error?: string }> {
  try {
    lastPoint = null;
    pauseDetector.reset();

    await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 10,
      timeInterval: 5000,
      foregroundService: {
        notificationTitle: 'TrailMate',
        notificationBody: 'Tour wird aufgezeichnet',
        notificationColor: '#FF6B35',
      },
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'GPS could not be started';
    console.error('[Tracking] startTracking failed:', error);
    return { success: false, error: message };
  }
}

export async function stopTracking(): Promise<void> {
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
    }
  } catch (error) {
    console.error('[Tracking] stopTracking failed:', error);
    // No throw – stopTracking should always complete "successfully"
    // so the recording store is reset to a clean state.
  } finally {
    lastPoint = null;
    pauseDetector.reset();
  }
}

export async function isTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
}

export async function setTrackingAccuracy(level: 'high' | 'low'): Promise<void> {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
  if (!isStarted) return;

  // Restart with different accuracy to save battery during pauses
  await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
  await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
    accuracy: level === 'high'
      ? Location.Accuracy.BestForNavigation
      : Location.Accuracy.Balanced,
    distanceInterval: level === 'high' ? 10 : 100,
    timeInterval: level === 'high' ? 5000 : 30000,
    foregroundService: {
      notificationTitle: 'TrailMate',
      notificationBody: level === 'high'
        ? 'Tour wird aufgezeichnet'
        : 'Tour pausiert',
      notificationColor: '#FF6B35',
    },
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
  });
}
