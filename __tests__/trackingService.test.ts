import * as TaskManager from 'expo-task-manager';
import { startTracking, stopTracking, GPS_GAP_RESET_MS } from '../lib/trackingService';
import { useRecordingStore } from '../stores/recordingStore';
import type { TrackPoint } from '../types';

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-location', () => ({
  startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  hasStartedLocationUpdatesAsync: jest.fn(() => Promise.resolve(true)),
  Accuracy: { BestForNavigation: 6, Balanced: 3 },
  ActivityType: { Fitness: 3 },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('../lib/trackPointStorage', () => ({
  batchAppendTrackPoint: jest.fn(),
  setActiveRecordingId: jest.fn(),
  loadTrackPoints: jest.fn(() => Promise.resolve([])),
  flushRemainingPoints: jest.fn(() => Promise.resolve()),
  deleteTrackPoints: jest.fn(() => Promise.resolve()),
}));

type TaskFn = (body: { data: unknown; error: unknown }) => Promise<void>;
const task = (TaskManager.defineTask as jest.Mock).mock.calls[0][1] as TaskFn;

const T0 = 1_700_000_000_000;
const LAT = 46.8;
const LNG = 8.2;
const STEP_100M = 0.0009; // ≈ 100 m nach Norden

async function measure(latitude: number, longitude: number, timestamp: number) {
  await task({
    data: {
      locations: [
        {
          coords: { latitude, longitude, altitude: 1000, speed: 1.2, accuracy: 5 },
          timestamp,
        },
      ],
    },
    error: null,
  });
}

function lastPoint(): TrackPoint {
  const points = useRecordingStore.getState().trackPoints;
  return points[points.length - 1];
}

describe('trackingService', () => {
  beforeEach(async () => {
    useRecordingStore.getState().startRecording();
    await startTracking();
  });

  it('smooths a second measurement 20 s later between both measurements', async () => {
    await measure(LAT, LNG, T0);
    await measure(LAT + STEP_100M, LNG, T0 + 20_000);
    const point = lastPoint();
    expect(useRecordingStore.getState().trackPoints).toHaveLength(2);
    expect(point.latitude).toBeGreaterThan(LAT);
    expect(point.latitude).toBeLessThan(LAT + STEP_100M);
  });

  it('puts the first point after a GPS gap exactly on the measurement', async () => {
    await measure(LAT, LNG, T0);
    await measure(LAT + STEP_100M, LNG, T0 + 2 * GPS_GAP_RESET_MS);
    expect(lastPoint()).toMatchObject({ latitude: LAT + STEP_100M, longitude: LNG });
  });

  it('starts a new tour exactly at the first measurement', async () => {
    await measure(LAT, LNG, T0);
    await stopTracking();
    useRecordingStore.getState().startRecording();
    await startTracking();
    const farLat = LAT + 0.18; // ≈ 20 km entfernt
    await measure(farLat, LNG, T0 + 5_000);
    expect(useRecordingStore.getState().trackPoints).toHaveLength(1);
    expect(lastPoint()).toMatchObject({ latitude: farLat, longitude: LNG });
  });
});
