// __tests__/trackPointStorage.test.ts
// Gepuffertes Schreiben der Track-Punkte: Chunk-Grösse, 30-s-Grenze,
// Reihenfolge über die Warteschlange und Löschen ohne Rückstände.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  batchAppendTrackPoint,
  deleteTrackPoints,
  loadTrackPoints,
  whenWritten,
} from '../lib/trackPointStorage';
import type { TrackPoint } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const T0 = 1_700_000_000_000;

function point(i: number, offsetMs = i * 1000): TrackPoint {
  return {
    latitude: 46.8 + i * 0.0001,
    longitude: 8.2,
    altitude: null,
    timestamp: T0 + offsetMs,
    speed: 1,
    accuracy: 5,
    isPause: false,
  };
}

function append(id: string, from: number, to: number) {
  for (let i = from; i < to; i++) batchAppendTrackPoint(id, point(i));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('batchAppendTrackPoint', () => {
  it('schreibt nach 10 Punkten einen Chunk', async () => {
    append('a', 0, 9);
    await whenWritten('a');
    expect(await AsyncStorage.getItem('@trailmate-chunks-a')).toBeNull();
    append('a', 9, 10);
    await whenWritten('a');
    expect(await AsyncStorage.getItem('@trailmate-chunks-a')).toBe('0');
    expect(await loadTrackPoints('a')).toHaveLength(10);
  });

  it('schreibt schon vor 10 Punkten, wenn der Puffer 30 s umfasst', async () => {
    batchAppendTrackPoint('b', point(0, 0));
    batchAppendTrackPoint('b', point(1, 31_000));
    await whenWritten('b');
    expect(await loadTrackPoints('b')).toHaveLength(2);
  });

  it('schreibt 20 schnelle Punkte in die Chunks 0 und 1, in Reihenfolge', async () => {
    append('c', 0, 20);
    await whenWritten('c');
    expect(await AsyncStorage.getItem('@trailmate-chunk-c-0')).not.toBeNull();
    expect(await AsyncStorage.getItem('@trailmate-chunk-c-1')).not.toBeNull();
    const loaded = await loadTrackPoints('c');
    expect(loaded.map((p) => p.timestamp)).toEqual(
      Array.from({ length: 20 }, (_, i) => T0 + i * 1000),
    );
  });

  it('lässt nach deleteTrackPoints direkt nach dem 10. Punkt keinen Schlüssel zurück', async () => {
    append('d', 0, 10);
    await deleteTrackPoints('d');
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter((k) => k.startsWith('@trailmate-chunk'))).toEqual([]);
  });

  it('schreibt nach einem gescheiterten multiSet weiter', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(AsyncStorage, 'multiSet').mockRejectedValueOnce(new Error('voll'));
    append('e', 0, 10);
    await whenWritten('e');
    expect(warn).toHaveBeenCalled();
    append('e', 10, 20);
    await whenWritten('e');
    const loaded = await loadTrackPoints('e');
    expect(loaded.map((p) => p.timestamp)).toEqual(
      Array.from({ length: 10 }, (_, i) => T0 + (i + 10) * 1000),
    );
  });
});
