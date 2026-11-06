// __tests__/recordingRecovery.test.ts
// Unfertige Tour nach einem Absturz: fortsetzen oder beenden.

import { useRecordingStore } from '../stores/recordingStore';
import { deleteTrackPoints, loadTrackPoints } from '../lib/trackPointStorage';
import type { TrackPoint } from '../types';

jest.mock('../lib/trackPointStorage', () => ({
  setActiveRecordingId: jest.fn(() => Promise.resolve()),
  loadTrackPoints: jest.fn(() => Promise.resolve([])),
  flushRemainingPoints: jest.fn(() => Promise.resolve()),
  deleteTrackPoints: jest.fn(() => Promise.resolve()),
}));

const mockLoad = loadTrackPoints as jest.Mock;
const T = 1_700_000_000_000;
const MIN = 60_000;

function point(timestamp: number, latitude: number, speed = 1): TrackPoint {
  return {
    latitude,
    longitude: 8.2,
    altitude: null,
    timestamp,
    speed,
    accuracy: 5,
    isPause: false,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useRecordingStore.setState({ status: 'idle', recordingId: null, trackPoints: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('resumeAfterCrash', () => {
  it('verwirft eine Tour ohne Punkte', async () => {
    mockLoad.mockResolvedValueOnce([]);
    const ok = await useRecordingStore.getState().resumeAfterCrash('rec');
    expect(ok).toBe(false);
    expect(useRecordingStore.getState().status).toBe('idle');
    expect(deleteTrackPoints).toHaveBeenCalledWith('rec');
  });

  it('läuft weiter und zählt die Zeit ohne App als Pause', async () => {
    const points = [point(T - 2 * MIN, 46.8), point(T - MIN, 46.801), point(T, 46.802)];
    mockLoad.mockResolvedValueOnce(points);
    jest.setSystemTime(T + 20 * MIN);

    const ok = await useRecordingStore.getState().resumeAfterCrash('rec');
    const state = useRecordingStore.getState();
    expect(ok).toBe(true);
    expect(state.status).toBe('recording');
    expect(state.recordingId).toBe('rec');
    expect(state.startedAt).toBe(T - 2 * MIN);
    expect(state.manualPauses).toEqual([{ start: T, end: T + 20 * MIN }]);
    expect(state.totalPauseDuration).toBe(20 * MIN);
    expect(state.currentStats.steps).toBe(0);

    const distance = state.currentStats.distance;
    expect(distance).toBeGreaterThan(0);
    // ~2 km nördlich, gleich nach dem Fortsetzen
    state.addPoint(point(T + 20 * MIN + 1000, 46.82));
    expect(useRecordingStore.getState().currentStats.distance).toBeCloseTo(distance);
  });
});

describe('recoverFromCrash', () => {
  it('beendet die Tour und schneidet ruhende Punkte der letzten 2 Minuten ab', async () => {
    mockLoad.mockResolvedValueOnce([
      point(T - 5 * MIN, 46.8),
      point(T - 4 * MIN, 46.801),
      point(T - MIN, 46.8011, 0),
      point(T, 46.8012, 0),
    ]);
    const ok = await useRecordingStore.getState().recoverFromCrash('rec');
    const state = useRecordingStore.getState();
    expect(ok).toBe(true);
    expect(state.status).toBe('stopped');
    expect(state.trackPoints.map((p) => p.timestamp)).toEqual([T - 5 * MIN, T - 4 * MIN]);
  });
});
