import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackPoint } from '../types';

const TRACK_KEY_PREFIX = '@trailmate-track-';
const CHUNK_KEY_PREFIX = '@trailmate-chunk-';
const CHUNK_META_PREFIX = '@trailmate-chunks-';
const ACTIVE_RECORDING_KEY = '@trailmate-active-recording';
const BATCH_SIZE = 50;

// In-memory buffer for batched writes
const pointBuffer: Map<string, TrackPoint[]> = new Map();

/**
 * Batched append: accumulates points in memory and flushes to a new
 * AsyncStorage chunk every BATCH_SIZE points. Avoids the O(n²) read-all
 * + write-all pattern.
 */
export function batchAppendTrackPoint(
  recordingId: string,
  point: TrackPoint
): void {
  const buffer = pointBuffer.get(recordingId) ?? [];
  buffer.push(point);
  pointBuffer.set(recordingId, buffer);

  if (buffer.length >= BATCH_SIZE) {
    const toFlush = [...buffer];
    pointBuffer.set(recordingId, []);
    flushChunk(recordingId, toFlush);
  }
}

async function flushChunk(
  recordingId: string,
  points: TrackPoint[]
): Promise<void> {
  const metaKey = `${CHUNK_META_PREFIX}${recordingId}`;
  const raw = await AsyncStorage.getItem(metaKey);
  const chunkIndex = raw ? parseInt(raw, 10) + 1 : 0;
  const chunkKey = `${CHUNK_KEY_PREFIX}${recordingId}-${chunkIndex}`;

  await AsyncStorage.multiSet([
    [chunkKey, JSON.stringify(points)],
    [metaKey, chunkIndex.toString()],
  ]);
}

/**
 * Flush any remaining buffered points to storage.
 * Call this when recording stops.
 */
export async function flushRemainingPoints(
  recordingId: string
): Promise<void> {
  const buffer = pointBuffer.get(recordingId);
  if (buffer && buffer.length > 0) {
    await flushChunk(recordingId, buffer);
    pointBuffer.set(recordingId, []);
  }
}

/**
 * Load all track points from chunked storage.
 */
export async function loadTrackPoints(
  recordingId: string
): Promise<TrackPoint[]> {
  const metaKey = `${CHUNK_META_PREFIX}${recordingId}`;
  const raw = await AsyncStorage.getItem(metaKey);
  if (raw === null) return [];

  const chunkCount = parseInt(raw, 10) + 1;
  const keys: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    keys.push(`${CHUNK_KEY_PREFIX}${recordingId}-${i}`);
  }

  const pairs = await AsyncStorage.multiGet(keys);
  const allPoints: TrackPoint[] = [];
  for (const [, value] of pairs) {
    if (value) {
      const chunk = JSON.parse(value) as TrackPoint[];
      allPoints.push(...chunk);
    }
  }
  return allPoints;
}

/**
 * Delete all stored track data for a recording.
 */
export async function deleteTrackPoints(
  recordingId: string
): Promise<void> {
  const metaKey = `${CHUNK_META_PREFIX}${recordingId}`;
  const raw = await AsyncStorage.getItem(metaKey);

  const keysToRemove = [metaKey];
  if (raw !== null) {
    const chunkCount = parseInt(raw, 10) + 1;
    for (let i = 0; i < chunkCount; i++) {
      keysToRemove.push(`${CHUNK_KEY_PREFIX}${recordingId}-${i}`);
    }
  }

  await AsyncStorage.multiRemove(keysToRemove);
  pointBuffer.delete(recordingId);
}

export async function getActiveRecordingId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_RECORDING_KEY);
}

export async function setActiveRecordingId(
  id: string | null
): Promise<void> {
  if (id === null) {
    await AsyncStorage.removeItem(ACTIVE_RECORDING_KEY);
  } else {
    await AsyncStorage.setItem(ACTIVE_RECORDING_KEY, id);
  }
}
