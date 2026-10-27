import { create } from 'zustand';
import type { TrackPoint } from '../types';
import {
  calculateTotalDistance,
  calculateElevation,
  calculateAvgSpeed,
  calculateAutoPauseSeconds,
  applyTrailingDriftCorrection,
} from '../lib/trackingCalculations';
import type { ManualPause } from '../lib/trackingCalculations';
import {
  setActiveRecordingId,
  loadTrackPoints,
  flushRemainingPoints,
  deleteTrackPoints,
} from '../lib/trackPointStorage';
import { normalizeRouteId } from '../lib/routeId';

type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

interface RecordingState {
  status: RecordingStatus;
  recordingId: string | null;
  // Geplante Route, falls die Aufzeichnung über «Navigation starten» kam
  routeId: string | null;
  trackPoints: TrackPoint[];
  startedAt: number | null;
  pausedAt: number | null;
  totalPauseDuration: number;
  manualPauses: ManualPause[];
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

  startRecording: (routeId?: string | null) => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  addPoint: (point: TrackPoint) => void;
  updateStats: () => void;
  setSteps: (steps: number) => void;
  reset: () => void;
  recoverFromCrash: (recordingId: string) => Promise<boolean>;
  resumeAfterCrash: (recordingId: string) => Promise<boolean>;
}

// Eine unfertige Tour ohne Punkte lohnt keine Zusammenfassung
async function discardEmptyRecording(recordingId: string): Promise<void> {
  await deleteTrackPoints(recordingId);
  await setActiveRecordingId(null);
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
  routeId: null,
  trackPoints: [],
  startedAt: null,
  pausedAt: null,
  totalPauseDuration: 0,
  manualPauses: [],
  manualPauseActive: false,
  currentStats: { ...initialStats },

  startRecording: (routeId?: string | null) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    setActiveRecordingId(id);
    set({
      status: 'recording',
      recordingId: id,
      routeId: normalizeRouteId(routeId),
      trackPoints: [],
      startedAt: Date.now(),
      pausedAt: null,
      totalPauseDuration: 0,
      manualPauses: [],
      manualPauseActive: false,
      currentStats: { ...initialStats },
    });
  },

  pauseRecording: () => {
    const now = Date.now();
    set((state) => ({
      status: 'paused',
      pausedAt: now,
      manualPauses: [...state.manualPauses, { start: now, end: null }],
      manualPauseActive: true,
    }));
  },

  resumeRecording: () => {
    const { pausedAt, totalPauseDuration, manualPauses } = get();
    const now = Date.now();
    const elapsed = pausedAt ? now - pausedAt : 0;
    set({
      status: 'recording',
      pausedAt: null,
      totalPauseDuration: totalPauseDuration + elapsed,
      manualPauses: manualPauses.map((p) => (p.end === null ? { ...p, end: now } : p)),
      manualPauseActive: false,
    });
  },

  stopRecording: () => set({ status: 'stopped' }),

  addPoint: (point: TrackPoint) => {
    set((state) => ({ trackPoints: [...state.trackPoints, point] }));
    get().updateStats();
  },

  updateStats: () => {
    const { trackPoints, startedAt, totalPauseDuration, pausedAt, manualPauses } = get();
    if (trackPoints.length === 0 || !startedAt) return;

    const distance = calculateTotalDistance(trackPoints, manualPauses);
    const { gain, loss } = calculateElevation(trackPoints, manualPauses);

    const now = Date.now();
    const totalDurationS = (now - startedAt) / 1000;
    const openPauseMs = pausedAt ? now - pausedAt : 0;
    const manualPauseS = (totalPauseDuration + openPauseMs) / 1000;
    const autoPauseS = calculateAutoPauseSeconds(trackPoints, manualPauses);
    const movingTimeS = Math.max(0, totalDurationS - manualPauseS - autoPauseS);
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
      routeId: null,
      trackPoints: [],
      startedAt: null,
      pausedAt: null,
      totalPauseDuration: 0,
      manualPauses: [],
      manualPauseActive: false,
      currentStats: { ...initialStats },
    });
  },

  recoverFromCrash: async (recordingId: string) => {
    const loaded = await loadTrackPoints(recordingId);
    if (loaded.length === 0) {
      await discardEmptyRecording(recordingId);
      return false;
    }
    // Wie beim normalen Beenden den ruhenden Nachlauf abschneiden
    const corrected = applyTrailingDriftCorrection(loaded);
    const points = corrected.length > 0 ? corrected : loaded;
    const distance = calculateTotalDistance(points);
    const { gain, loss } = calculateElevation(points);
    const startedAt = points[0].timestamp;
    const lastTimestamp = points[points.length - 1].timestamp;
    const totalDurationS = (lastTimestamp - startedAt) / 1000;
    const movingTimeS = Math.max(0, totalDurationS - calculateAutoPauseSeconds(points));
    const avgSpeed = calculateAvgSpeed(distance, movingTimeS);

    set({
      status: 'stopped',
      recordingId,
      // Die Zuordnung zur Route übersteht keinen Absturz
      routeId: null,
      trackPoints: points,
      startedAt,
      pausedAt: null,
      totalPauseDuration: 0,
      manualPauses: [],
      manualPauseActive: false,
      currentStats: {
        distance,
        elevationGain: gain,
        elevationLoss: loss,
        duration: totalDurationS,
        movingTime: movingTimeS,
        avgSpeed,
        steps: 0,
      },
    });
    return true;
  },

  resumeAfterCrash: async (recordingId: string) => {
    const points = await loadTrackPoints(recordingId);
    if (points.length === 0) {
      await discardEmptyRecording(recordingId);
      return false;
    }
    // Die Zeit ohne App zählt als Pause: weder Dauer noch die gerade Linie
    // über die Lücke fliessen in die Werte ein
    const lastTimestamp = points[points.length - 1].timestamp;
    const now = Date.now();
    set({
      status: 'recording',
      recordingId,
      routeId: null,
      trackPoints: points,
      startedAt: points[0].timestamp,
      pausedAt: null,
      totalPauseDuration: Math.max(0, now - lastTimestamp),
      manualPauses: [{ start: lastTimestamp, end: now }],
      manualPauseActive: false,
      currentStats: { ...initialStats },
    });
    get().updateStats();
    return true;
  },
}));
