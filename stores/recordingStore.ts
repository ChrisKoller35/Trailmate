import { create } from 'zustand';
import type { TrackPoint } from '../types';
import {
  calculateTotalDistance,
  calculateElevation,
  calculateAvgSpeed,
} from '../lib/trackingCalculations';
import {
  setActiveRecordingId,
  loadTrackPoints,
  flushRemainingPoints,
  deleteTrackPoints,
} from '../lib/trackPointStorage';

type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

interface RecordingState {
  status: RecordingStatus;
  recordingId: string | null;
  trackPoints: TrackPoint[];
  startedAt: number | null;
  pausedAt: number | null;
  totalPauseDuration: number;
  manualPauseActive: boolean;
  currentStats: {
    distance: number;
    elevationGain: number;
    elevationLoss: number;
    duration: number;
    movingTime: number;
    avgSpeed: number;
    steps: number;
  };

  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  addPoint: (point: TrackPoint) => void;
  updateStats: () => void;
  setSteps: (steps: number) => void;
  reset: () => void;
  recoverFromCrash: (recordingId: string) => Promise<void>;
}

const initialStats = {
  distance: 0,
  elevationGain: 0,
  elevationLoss: 0,
  duration: 0,
  movingTime: 0,
  avgSpeed: 0,
  steps: 0,
};

export const useRecordingStore = create<RecordingState>((set, get) => ({
  status: 'idle',
  recordingId: null,
  trackPoints: [],
  startedAt: null,
  pausedAt: null,
  totalPauseDuration: 0,
  manualPauseActive: false,
  currentStats: { ...initialStats },

  startRecording: () => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    setActiveRecordingId(id);
    set({
      status: 'recording',
      recordingId: id,
      trackPoints: [],
      startedAt: Date.now(),
      pausedAt: null,
      totalPauseDuration: 0,
      manualPauseActive: false,
      currentStats: { ...initialStats },
    });
  },

  pauseRecording: () =>
    set({
      status: 'paused',
      pausedAt: Date.now(),
      manualPauseActive: true,
    }),

  resumeRecording: () => {
    const { pausedAt, totalPauseDuration } = get();
    const elapsed = pausedAt ? Date.now() - pausedAt : 0;
    set({
      status: 'recording',
      pausedAt: null,
      totalPauseDuration: totalPauseDuration + elapsed,
      manualPauseActive: false,
    });
  },

  stopRecording: () => set({ status: 'stopped' }),

  addPoint: (point: TrackPoint) => {
    set((state) => ({ trackPoints: [...state.trackPoints, point] }));
    get().updateStats();
  },

  updateStats: () => {
    const { trackPoints, startedAt, totalPauseDuration } = get();
    if (trackPoints.length === 0 || !startedAt) return;

    const distance = calculateTotalDistance(trackPoints);
    const { gain, loss } = calculateElevation(trackPoints);

    const now = Date.now();
    const totalDurationS = (now - startedAt) / 1000;
    const movingTimeS = Math.max(0, totalDurationS - totalPauseDuration / 1000);
    const avgSpeed = calculateAvgSpeed(distance, movingTimeS);

    set((state) => ({
      currentStats: {
        ...state.currentStats,
        distance,
        elevationGain: gain,
        elevationLoss: loss,
        duration: totalDurationS,
        movingTime: movingTimeS,
        avgSpeed,
      },
    }));
  },

  setSteps: (steps: number) =>
    set((state) => ({
      currentStats: { ...state.currentStats, steps },
    })),

  reset: () => {
    const { recordingId } = get();
    if (recordingId) {
      flushRemainingPoints(recordingId).then(() => deleteTrackPoints(recordingId));
      setActiveRecordingId(null);
    }
    set({
      status: 'idle',
      recordingId: null,
      trackPoints: [],
      startedAt: null,
      pausedAt: null,
      totalPauseDuration: 0,
      manualPauseActive: false,
      currentStats: { ...initialStats },
    });
  },

  recoverFromCrash: async (recordingId: string) => {
    const points = await loadTrackPoints(recordingId);
    if (points.length === 0) {
      await setActiveRecordingId(null);
      return;
    }
    const distance = calculateTotalDistance(points);
    const { gain, loss } = calculateElevation(points);
    const startedAt = points[0].timestamp;
    const lastTimestamp = points[points.length - 1].timestamp;
    const totalDurationS = (lastTimestamp - startedAt) / 1000;
    const avgSpeed = calculateAvgSpeed(distance, totalDurationS);

    set({
      status: 'stopped',
      recordingId,
      trackPoints: points,
      startedAt,
      pausedAt: null,
      totalPauseDuration: 0,
      manualPauseActive: false,
      currentStats: {
        distance,
        elevationGain: gain,
        elevationLoss: loss,
        duration: totalDurationS,
        movingTime: totalDurationS,
        avgSpeed,
        steps: 0,
      },
    });
  },
}));
