import {
  hasConsecutiveDays,
  evaluateConditions,
  type BadgeContext,
} from '../lib/badgeEngine';

// ─── Helper function ──────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<BadgeContext> = {}): BadgeContext {
  return {
    totalDistanceM: 0,
    totalElevationM: 0,
    totalRecordings: 0,
    recordingsThisYear: 0,
    maxDurationSeconds: 0,
    hasEarlyStart: false,
    hasConsecutive7Days: false,
    hasPost: false,
    isEarlyAdopter: false,
    hasWinterHike: false,
    trailReports: 0,
    ...overrides,
  };
}

// ─── hasConsecutiveDays ────────────────────────────────────────────────────────

describe('hasConsecutiveDays', () => {
  it('returns false for an empty array', () => {
    expect(hasConsecutiveDays([], 7)).toBe(false);
  });

  it('returns false when fewer dates than required days', () => {
    expect(hasConsecutiveDays(['2024-01-01', '2024-01-02'], 7)).toBe(false);
  });

  it('returns false when dates are not consecutive (gap in middle)', () => {
    const dates = [
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      // gap
      '2024-01-05',
      '2024-01-06',
      '2024-01-07',
      '2024-01-08',
    ];
    expect(hasConsecutiveDays(dates, 7)).toBe(false);
  });

  it('returns true for exactly 7 consecutive days', () => {
    const dates = [
      '2024-03-01',
      '2024-03-02',
      '2024-03-03',
      '2024-03-04',
      '2024-03-05',
      '2024-03-06',
      '2024-03-07',
    ];
    expect(hasConsecutiveDays(dates, 7)).toBe(true);
  });

  it('returns true when more than 7 consecutive days exist', () => {
    const dates = [
      '2024-03-01',
      '2024-03-02',
      '2024-03-03',
      '2024-03-04',
      '2024-03-05',
      '2024-03-06',
      '2024-03-07',
      '2024-03-08',
    ];
    expect(hasConsecutiveDays(dates, 7)).toBe(true);
  });

  it('deduplicates multiple entries on the same day', () => {
    // Two recordings on the same day should count as one day
    const dates = [
      '2024-03-01T08:00:00Z',
      '2024-03-01T14:00:00Z', // same day as above
      '2024-03-02',
      '2024-03-03',
      '2024-03-04',
      '2024-03-05',
      '2024-03-06',
      '2024-03-07',
    ];
    expect(hasConsecutiveDays(dates, 7)).toBe(true);
  });

  it('returns false for 7 days required but only 6 consecutive', () => {
    const dates = [
      '2024-03-01',
      '2024-03-02',
      '2024-03-03',
      '2024-03-04',
      '2024-03-05',
      '2024-03-06',
    ];
    expect(hasConsecutiveDays(dates, 7)).toBe(false);
  });

  it('returns true for a 3-day streak when only 3 are required', () => {
    expect(
      hasConsecutiveDays(['2024-06-10', '2024-06-11', '2024-06-12'], 3),
    ).toBe(true);
  });
});

// ─── evaluateConditions – all 19 badges ─────────────────────────────────────

describe('evaluateConditions', () => {
  it('returns empty array when no conditions are met', () => {
    expect(evaluateConditions(makeCtx())).toEqual([]);
  });

  // Distance milestones
  it('awards 100km_total at exactly 100 000 m', () => {
    expect(evaluateConditions(makeCtx({ totalDistanceM: 100_000 }))).toContain('100km_total');
  });

  it('does not award 100km_total below threshold', () => {
    expect(evaluateConditions(makeCtx({ totalDistanceM: 99_999 }))).not.toContain('100km_total');
  });

  it('awards 500km_total at exactly 500 000 m', () => {
    expect(evaluateConditions(makeCtx({ totalDistanceM: 500_000 }))).toContain('500km_total');
  });

  it('awards 1000km_total at exactly 1 000 000 m', () => {
    expect(evaluateConditions(makeCtx({ totalDistanceM: 1_000_000 }))).toContain('1000km_total');
  });

  // Elevation milestones
  it('awards 5000hm_total at exactly 5 000 m elevation', () => {
    expect(evaluateConditions(makeCtx({ totalElevationM: 5_000 }))).toContain('5000hm_total');
  });

  it('awards 10000hm_total at exactly 10 000 m elevation', () => {
    expect(evaluateConditions(makeCtx({ totalElevationM: 10_000 }))).toContain('10000hm_total');
  });

  it('awards 50000hm_total at exactly 50 000 m elevation', () => {
    expect(evaluateConditions(makeCtx({ totalElevationM: 50_000 }))).toContain('50000hm_total');
  });

  // Tour count
  it('awards 10_tours at exactly 10 recordings', () => {
    expect(evaluateConditions(makeCtx({ totalRecordings: 10 }))).toContain('10_tours');
  });

  it('awards 50_tours at exactly 50 recordings', () => {
    expect(evaluateConditions(makeCtx({ totalRecordings: 50 }))).toContain('50_tours');
  });

  it('awards 100_tours at exactly 100 recordings', () => {
    expect(evaluateConditions(makeCtx({ totalRecordings: 100 }))).toContain('100_tours');
  });

  // Single tour duration
  it('awards tour_6h at exactly 21 600 seconds', () => {
    expect(evaluateConditions(makeCtx({ maxDurationSeconds: 21_600 }))).toContain('tour_6h');
  });

  it('awards tour_10h at exactly 36 000 seconds', () => {
    expect(evaluateConditions(makeCtx({ maxDurationSeconds: 36_000 }))).toContain('tour_10h');
  });

  // Time-based
  it('awards early_bird when hasEarlyStart is true', () => {
    expect(evaluateConditions(makeCtx({ hasEarlyStart: true }))).toContain('early_bird');
  });

  it('awards 7_day_streak when hasConsecutive7Days is true', () => {
    expect(evaluateConditions(makeCtx({ hasConsecutive7Days: true }))).toContain('7_day_streak');
  });

  it('awards 30_tours_year at exactly 30 recordings this year', () => {
    expect(evaluateConditions(makeCtx({ recordingsThisYear: 30 }))).toContain('30_tours_year');
  });

  // Weather / Seasons
  it('awards winter_hike when hasWinterHike is true', () => {
    expect(evaluateConditions(makeCtx({ hasWinterHike: true }))).toContain('winter_hike');
  });

  // Social
  it('awards first_post when hasPost is true', () => {
    expect(evaluateConditions(makeCtx({ hasPost: true }))).toContain('first_post');
  });

  // Trail reporting
  it('awards trail_reporter_5 at exactly 5 reports', () => {
    expect(evaluateConditions(makeCtx({ trailReports: 5 }))).toContain('trail_reporter_5');
  });

  it('awards trail_reporter_25 at exactly 25 reports', () => {
    expect(evaluateConditions(makeCtx({ trailReports: 25 }))).toContain('trail_reporter_25');
  });

  // Special
  it('awards early_adopter when isEarlyAdopter is true', () => {
    expect(evaluateConditions(makeCtx({ isEarlyAdopter: true }))).toContain('early_adopter');
  });

  // Stacking: higher milestones also unlock lower ones
  it('awards all three distance badges when 1000 km is reached', () => {
    const badges = evaluateConditions(makeCtx({ totalDistanceM: 1_000_000 }));
    expect(badges).toContain('100km_total');
    expect(badges).toContain('500km_total');
    expect(badges).toContain('1000km_total');
  });
});
