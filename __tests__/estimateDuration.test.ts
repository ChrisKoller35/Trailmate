import { estimateDuration } from '../hooks/useRouting';

// brouterService performs network requests; the pure formula does not need it.
jest.mock('../lib/brouterService', () => ({ calculateHikingRoute: jest.fn() }));

// ─── estimateDuration (SAC hiking time formula) ───────────────────────────────

describe('estimateDuration', () => {
  it('returns 0 for an empty route', () => {
    expect(estimateDuration(0, 0, 0)).toBe(0);
  });

  it('uses 15 min per km on flat terrain', () => {
    expect(estimateDuration(4000, 0, 0)).toBe(60);
  });

  it('uses 15 min per 100 m ascent when only climbing', () => {
    expect(estimateDuration(0, 400, 0)).toBe(60);
  });

  it('uses 7.5 min per 100 m descent', () => {
    expect(estimateDuration(0, 0, 400)).toBe(30);
  });

  it('adds half of the vertical time when horizontal dominates', () => {
    // horizontal 150 min, vertical 30 min → 150 + 15
    expect(estimateDuration(10_000, 200, 0)).toBe(165);
  });

  it('adds half of the horizontal time when vertical dominates', () => {
    // horizontal 30 min, vertical 150 + 37.5 min → 187.5 + 15
    expect(estimateDuration(2000, 1000, 500)).toBe(202.5);
  });

  it('handles equal horizontal and vertical time', () => {
    // horizontal 60 min, vertical 60 min → 60 + 30
    expect(estimateDuration(4000, 400, 0)).toBe(90);
  });

  it('grows monotonically with distance and elevation', () => {
    const base = estimateDuration(8000, 500, 500);
    expect(estimateDuration(9000, 500, 500)).toBeGreaterThan(base);
    expect(estimateDuration(8000, 600, 500)).toBeGreaterThan(base);
    expect(estimateDuration(8000, 500, 600)).toBeGreaterThan(base);
  });
});
