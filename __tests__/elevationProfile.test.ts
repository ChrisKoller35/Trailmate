import { buildTrackElevationProfile } from '../lib/elevationProfile';
import { calculateTotalDistance } from '../lib/trackingCalculations';
import type { TrackPoint } from '../types';

const T0 = 1_700_000_000_000;

function makePoints(count: number, altitude: (i: number) => number | null = (i) => 500 + i): TrackPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    latitude: 46.8 + i * 0.0005,
    longitude: 8.2 + i * 0.0003,
    altitude: altitude(i),
    timestamp: T0 + i * 10_000,
    speed: null,
    accuracy: null,
  }));
}

function lastDistance(profile: { distance: number }[]): number {
  return profile[profile.length - 1].distance;
}

describe('buildTrackElevationProfile', () => {
  it('endet bei der Gesamtdistanz', () => {
    const points = makePoints(10);
    const profile = buildTrackElevationProfile(points);
    expect(profile).toHaveLength(10);
    expect(profile[0].distance).toBe(0);
    expect(lastDistance(profile)).toBeCloseTo(calculateTotalDistance(points), 6);
  });

  it('zählt die Strecke eines Punkts ohne Höhe mit', () => {
    const points = makePoints(10, (i) => (i === 5 ? null : 500 + i));
    const profile = buildTrackElevationProfile(points);
    expect(profile).toHaveLength(9);
    expect(lastDistance(profile)).toBeCloseTo(calculateTotalDistance(points), 6);
  });

  it('zählt einen Schritt über eine manuelle Pause nicht', () => {
    const points = makePoints(10);
    // Bahnfahrt zwischen Punkt 4 und 5: weiter Sprung während der Pause
    for (let i = 5; i < points.length; i++) points[i].latitude += 0.2;
    const manualPauses = [{ start: T0 + 41_000, end: T0 + 49_000 }];
    const profile = buildTrackElevationProfile(points, manualPauses);
    const total = calculateTotalDistance(points, manualPauses);
    expect(total).toBeLessThan(calculateTotalDistance(points) - 20_000);
    expect(lastDistance(profile)).toBeCloseTo(total, 6);
    expect(profile[5].distance).toBeCloseTo(profile[4].distance, 6);
  });

  it('dünnt 1000 Punkte auf höchstens 300 aus', () => {
    const points = makePoints(1000);
    const profile = buildTrackElevationProfile(points);
    expect(profile.length).toBeLessThanOrEqual(300);
    expect(profile.length).toBeGreaterThan(250);
    expect(profile[0].distance).toBe(0);
    expect(lastDistance(profile)).toBeCloseTo(calculateTotalDistance(points), 6);
    expect(profile[profile.length - 1].elevation).toBe(1499);
  });

  it('gibt bei weniger als zwei Punkten mit Höhe eine leere Liste', () => {
    expect(buildTrackElevationProfile(makePoints(5, (i) => (i === 2 ? 800 : null)))).toEqual([]);
    expect(buildTrackElevationProfile([])).toEqual([]);
  });
});
