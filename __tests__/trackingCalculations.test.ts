import {
  calculateDistance,
  calculateTotalDistance,
  calculateElevation,
  calculateAvgSpeed,
  applyTrailingDriftCorrection,
} from '../lib/trackingCalculations';
import type { TrackPoint } from '../types';

// ─── Helper function ──────────────────────────────────────────────────────────

function makePoint(overrides: Partial<TrackPoint> & { latitude: number; longitude: number }): TrackPoint {
  return {
    altitude: null,
    timestamp: Date.now(),
    speed: null,
    accuracy: null,
    isPause: false,
    ...overrides,
  };
}

// ─── calculateDistance (Haversine) ───────────────────────────────────────────

describe('calculateDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(calculateDistance(46.8, 8.2, 46.8, 8.2)).toBe(0);
  });

  it('calculates a known distance: Zurich ↔ Bern (~95 km)', () => {
    // Zurich: 47.3769° N, 8.5417° E
    // Bern:   46.9480° N, 7.4474° E
    const dist = calculateDistance(47.3769, 8.5417, 46.9480, 7.4474);
    // Haversine gives ~95.7 km; allow ±2 km tolerance
    expect(dist).toBeGreaterThan(93_000);
    expect(dist).toBeLessThan(98_000);
  });

  it('calculates a short distance accurately (~111 m per 0.001°)', () => {
    // Moving 0.001° north at equator ≈ 111 m
    const dist = calculateDistance(0, 0, 0.001, 0);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });

  it('is symmetric (A→B == B→A)', () => {
    const d1 = calculateDistance(46.5, 7.0, 47.0, 8.0);
    const d2 = calculateDistance(47.0, 8.0, 46.5, 7.0);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

// ─── calculateTotalDistance ───────────────────────────────────────────────────

describe('calculateTotalDistance', () => {
  it('returns 0 for an empty point list', () => {
    expect(calculateTotalDistance([])).toBe(0);
  });

  it('returns 0 for a single point', () => {
    expect(calculateTotalDistance([makePoint({ latitude: 46.8, longitude: 8.2 })])).toBe(0);
  });

  it('sums distances for multiple points', () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0 }),
      makePoint({ latitude: 0, longitude: 0.001 }),
      makePoint({ latitude: 0, longitude: 0.002 }),
    ];
    const total = calculateTotalDistance(points);
    const single = calculateDistance(0, 0, 0, 0.001);
    expect(total).toBeCloseTo(single * 2, 0);
  });

  it('is order-dependent (straight line vs zigzag)', () => {
    const straight = [
      makePoint({ latitude: 0, longitude: 0 }),
      makePoint({ latitude: 0, longitude: 1 }),
    ];
    const zigzag = [
      makePoint({ latitude: 0, longitude: 0 }),
      makePoint({ latitude: 1, longitude: 0.5 }),
      makePoint({ latitude: 0, longitude: 1 }),
    ];
    expect(calculateTotalDistance(zigzag)).toBeGreaterThan(calculateTotalDistance(straight));
  });
});

// ─── calculateElevation ──────────────────────────────────────────────────────

describe('calculateElevation', () => {
  it('returns 0 gain and 0 loss for an empty list', () => {
    expect(calculateElevation([])).toEqual({ gain: 0, loss: 0 });
  });

  it('ignores altitude changes below the noise threshold (2 m)', () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0, altitude: 1000 }),
      makePoint({ latitude: 0, longitude: 0.001, altitude: 1001.5 }), // +1.5 m → below threshold
    ];
    expect(calculateElevation(points)).toEqual({ gain: 0, loss: 0 });
  });

  it('counts altitude gain above the noise threshold', () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0, altitude: 1000 }),
      makePoint({ latitude: 0, longitude: 0.001, altitude: 1050 }), // +50 m
    ];
    const { gain, loss } = calculateElevation(points);
    expect(gain).toBeCloseTo(50, 1);
    expect(loss).toBe(0);
  });

  it('counts altitude loss above the noise threshold', () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0, altitude: 1050 }),
      makePoint({ latitude: 0, longitude: 0.001, altitude: 1000 }), // -50 m
    ];
    const { gain, loss } = calculateElevation(points);
    expect(gain).toBe(0);
    expect(loss).toBeCloseTo(50, 1);
  });

  it('handles null altitudes gracefully (skips pairs with null)', () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0, altitude: null }),
      makePoint({ latitude: 0, longitude: 0.001, altitude: 1000 }),
      makePoint({ latitude: 0, longitude: 0.002, altitude: 1100 }), // +100 m
    ];
    const { gain } = calculateElevation(points);
    expect(gain).toBeCloseTo(100, 1);
  });

  it('accumulates gain and loss across a full up-and-down route', () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0, altitude: 1000 }),
      makePoint({ latitude: 0, longitude: 0.001, altitude: 1200 }), // +200
      makePoint({ latitude: 0, longitude: 0.002, altitude: 1050 }), // -150
    ];
    const { gain, loss } = calculateElevation(points);
    expect(gain).toBeCloseTo(200, 1);
    expect(loss).toBeCloseTo(150, 1);
  });
});

// ─── calculateAvgSpeed ───────────────────────────────────────────────────────

describe('calculateAvgSpeed', () => {
  it('returns 0 when movingTime is 0', () => {
    expect(calculateAvgSpeed(10000, 0)).toBe(0);
  });

  it('returns 0 when movingTime is negative', () => {
    expect(calculateAvgSpeed(10000, -1)).toBe(0);
  });

  it('calculates correct km/h (10 km in 1 hour = 10 km/h)', () => {
    expect(calculateAvgSpeed(10_000, 3600)).toBeCloseTo(10, 2);
  });

  it('calculates correct km/h (5 km in 30 min = 10 km/h)', () => {
    expect(calculateAvgSpeed(5_000, 1800)).toBeCloseTo(10, 2);
  });

  it('calculates typical hiking speed (~4 km/h)', () => {
    // 4 km in 3600 s = 4 km/h
    expect(calculateAvgSpeed(4_000, 3600)).toBeCloseTo(4, 2);
  });
});

// ─── applyTrailingDriftCorrection ────────────────────────────────────────────

describe('applyTrailingDriftCorrection', () => {
  const NOW = 1_700_000_000_000; // fixed timestamp base

  it('returns empty array unchanged', () => {
    expect(applyTrailingDriftCorrection([])).toEqual([]);
  });

  it('keeps all points when last points have movement (speed >= 0.3 m/s)', () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0, timestamp: NOW - 5000, speed: 1.0 }),
      makePoint({ latitude: 0, longitude: 0.001, timestamp: NOW - 3000, speed: 0.8 }),
      makePoint({ latitude: 0, longitude: 0.002, timestamp: NOW - 1000, speed: 0.5 }),
      makePoint({ latitude: 0, longitude: 0.003, timestamp: NOW, speed: 0.4 }),
    ];
    const result = applyTrailingDriftCorrection(points);
    expect(result.length).toBe(4);
  });

  it('removes trailing stationary points within the last 2 minutes', () => {
    const points = [
      // Older moving point (outside the 2-min window)
      makePoint({ latitude: 0, longitude: 0, timestamp: NOW - 200_000, speed: 1.0 }),
      // Moving points within window
      makePoint({ latitude: 0, longitude: 0.001, timestamp: NOW - 90_000, speed: 0.8 }),
      // Last movement
      makePoint({ latitude: 0, longitude: 0.002, timestamp: NOW - 60_000, speed: 0.4 }),
      // Stationary drift (speed < 0.3) within last 2 minutes
      makePoint({ latitude: 0, longitude: 0.0021, timestamp: NOW - 30_000, speed: 0.1 }),
      makePoint({ latitude: 0, longitude: 0.0022, timestamp: NOW - 10_000, speed: 0.05 }),
      makePoint({ latitude: 0, longitude: 0.0023, timestamp: NOW, speed: 0.0 }),
    ];
    const result = applyTrailingDriftCorrection(points);
    // Should cut off at the last moving point (index 2, inclusive = 3 points)
    expect(result.length).toBe(3);
    expect(result[result.length - 1].speed).toBeGreaterThanOrEqual(0.3);
  });

  it('does not remove points outside the 2-minute window even if stationary', () => {
    const points = [
      makePoint({ latitude: 0, longitude: 0, timestamp: NOW - 300_000, speed: 0.0 }), // outside window
      makePoint({ latitude: 0, longitude: 0.001, timestamp: NOW - 200_000, speed: 0.5 }),
      makePoint({ latitude: 0, longitude: 0.002, timestamp: NOW, speed: 0.6 }),
    ];
    const result = applyTrailingDriftCorrection(points);
    expect(result.length).toBe(3);
  });
});
