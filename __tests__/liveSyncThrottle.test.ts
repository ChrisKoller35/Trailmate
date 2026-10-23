// __tests__/liveSyncThrottle.test.ts
// Takt für das Senden des Live-Standorts (lib/liveSyncThrottle).

import {
  initialLiveSyncState,
  isShareStillOpen,
  shouldSendLocation,
  syncIntervalMs,
} from '../lib/liveSyncThrottle';

const MIN = 60_000;
const T0 = 1_700_000_000_000;

describe('shouldSendLocation', () => {
  it('sends the first point immediately', () => {
    expect(
      shouldSendLocation({
        now: T0,
        pointTime: T0 - 1000,
        state: initialLiveSyncState,
        updateIntervalMinutes: 10,
      }),
    ).toBe(true);
  });

  it('sends nothing without a point', () => {
    expect(
      shouldSendLocation({
        now: T0,
        pointTime: undefined,
        state: initialLiveSyncState,
        updateIntervalMinutes: 10,
      }),
    ).toBe(false);
  });

  it('waits for the session interval before sending again', () => {
    const state = { lastSentAt: T0, lastSentPointTime: T0 };
    const at = (now: number) =>
      shouldSendLocation({ now, pointTime: now, state, updateIntervalMinutes: 10 });

    expect(at(T0 + 9 * MIN)).toBe(false);
    expect(at(T0 + 10 * MIN)).toBe(true);
  });

  it('sends nothing when no newer point exists, even after the interval', () => {
    const state = { lastSentAt: T0, lastSentPointTime: T0 };
    expect(
      shouldSendLocation({ now: T0 + 60 * MIN, pointTime: T0, state, updateIntervalMinutes: 5 }),
    ).toBe(false);
    expect(
      shouldSendLocation({
        now: T0 + 60 * MIN,
        pointTime: T0,
        state,
        updateIntervalMinutes: 5,
        force: true,
      }),
    ).toBe(false);
  });

  it('sends a newer point immediately when forced (back in the app)', () => {
    const state = { lastSentAt: T0, lastSentPointTime: T0 };
    expect(
      shouldSendLocation({
        now: T0 + MIN / 2,
        pointTime: T0 + 1000,
        state,
        updateIntervalMinutes: 30,
        force: true,
      }),
    ).toBe(true);
  });

  it('never sends more often than once a minute', () => {
    const state = { lastSentAt: T0, lastSentPointTime: T0 };
    const at = (now: number) =>
      shouldSendLocation({ now, pointTime: now, state, updateIntervalMinutes: 0 });

    expect(at(T0 + 59_000)).toBe(false);
    expect(at(T0 + MIN)).toBe(true);
  });
});

describe('syncIntervalMs', () => {
  it('uses the session interval with a floor of 1 minute', () => {
    expect(syncIntervalMs(10)).toBe(10 * MIN);
    expect(syncIntervalMs(0)).toBe(MIN);
    expect(syncIntervalMs(-5)).toBe(MIN);
    expect(syncIntervalMs(null)).toBe(MIN);
  });
});

describe('isShareStillOpen', () => {
  it('is open for 48 hours after the start', () => {
    const started = new Date(T0).toISOString();
    expect(isShareStillOpen(started, T0 + 47 * 60 * MIN)).toBe(true);
    expect(isShareStillOpen(started, T0 + 48 * 60 * MIN)).toBe(false);
  });
});
