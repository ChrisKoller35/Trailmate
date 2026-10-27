import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackPoint } from '../types';

const TRACK_KEY_PREFIX = '@trailmate-track-';
const CHUNK_KEY_PREFIX = '@trailmate-chunk-';
const CHUNK_META_PREFIX = '@trailmate-chunks-';
const ACTIVE_RECORDING_KEY = '@trailmate-active-recording';
// Bei einem Absturz gehen höchstens so viele Punkte bzw. so viel Zeit verloren
const BATCH_SIZE = 10;
const MAX_BUFFER_AGE_MS = 30_000;

// In-memory buffer for batched writes
const pointBuffer: Map<string, TrackPoint[]> = new Map();
// Schreib- und Löschvorgänge einer Aufnahme laufen nacheinander, damit zwei
// schnelle Schreibvorgänge nicht denselben Chunk-Zähler lesen
const writeQueue: Map<string, Promise<void>> = new Map();

function enqueue(recordingId: string, task: () => Promise<void>): Promise<void> {
  const previous = writeQueue.get(recordingId) ?? Promise.resolve();
  const next = previous.then(task).catch((error: unknown) => {
    console.warn(`Track-Punkte von ${recordingId} konnten nicht gespeichert werden`, error);
  });
  writeQueue.set(recordingId, next);
  void next.then(() => {
    if (writeQueue.get(recordingId) === next) writeQueue.delete(recordingId);
  });
  return next;
}

/** Erfüllt, sobald alles bis jetzt Angestossene geschrieben ist. */
export function whenWritten(recordingId: string): Promise<void> {
  return writeQueue.get(recordingId) ?? Promise.resolve();
}

/**
 * Batched append: accumulates points in memory and flushes to a new
 * AsyncStorage chunk every BATCH_SIZE points or as soon as the buffer
 * spans MAX_BUFFER_AGE_MS. Avoids the O(n²) read-all + write-all pattern.
 */
export function batchAppendTrackPoint(
  recordingId: string,
  point: TrackPoint
): void {
  const buffer = pointBuffer.get(recordingId) ?? [];
  buffer.push(point);
  pointBuffer.set(recordingId, buffer);

  if (
    buffer.length >= BATCH_SIZE ||
    point.timestamp - buffer[0].timestamp >= MAX_BUFFER_AGE_MS
  ) {
    pointBuffer.set(recordingId, []);
    void enqueue(recordingId, () => flushChunk(recordingId, buffer));
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
  await whenWritten(recordingId);
  const buffer = pointBuffer.get(recordingId);
  if (buffer && buffer.length > 0) {
    pointBuffer.set(recordingId, []);
    await enqueue(recordingId, () => flushChunk(recordingId, buffer));
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
 * Delete all stored track data for a recording. Runs after every write that
 * was already started, so no chunk of this recording is left behind.
 */
export async function deleteTrackPoints(
  recordingId: string
): Promise<void> {
  await whenWritten(recordingId);
  pointBuffer.delete(recordingId);
  await enqueue(recordingId, async () => {
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
  });
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
