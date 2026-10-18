import KalmanFilter from '../lib/kalmanFilter';
import { PauseDetector } from '../lib/pauseDetection';

// ─── KalmanFilter ─────────────────────────────────────────────────────────────

describe('KalmanFilter', () => {
  it('returns the first measurement unchanged', () => {
    const filter = new KalmanFilter();
    expect(filter.process(46.8, 8.2, 10)).toEqual({ lat: 46.8, lng: 8.2 });
  });

  it('stays put for repeated identical measurements', () => {
    const filter = new KalmanFilter();
    filter.process(46.8, 8.2, 10);
    const result = filter.process(46.8, 8.2, 10);
    expect(result.lat).toBeCloseTo(46.8, 10);
    expect(result.lng).toBeCloseTo(8.2, 10);
  });

  it('moves part of the way towards a new measurement', () => {
    const filter = new KalmanFilter();
    filter.process(46.8, 8.2, 10);
    const result = filter.process(46.801, 8.201, 10);
    expect(result.lat).toBeGreaterThan(46.8);
    expect(result.lat).toBeLessThan(46.801);
    expect(result.lng).toBeGreaterThan(8.2);
    expect(result.lng).toBeLessThan(8.201);
  });

  it('clamps accuracy below 3 m so a zero accuracy does not break the filter', () => {
    const filter = new KalmanFilter();
    filter.process(46.8, 8.2, 0);
    const result = filter.process(46.801, 8.201, 0);
    expect(Number.isFinite(result.lat)).toBe(true);
    expect(Number.isFinite(result.lng)).toBe(true);
  });
});

// ─── PauseDetector ────────────────────────────────────────────────────────────

describe('PauseDetector', () => {
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not report a pause before 60 s of standing still', () => {
    const detector = new PauseDetector();
    expect(detector.checkPause(0, 5)).toBe(false);
    now += 59_000;
    expect(detector.checkPause(0, 5)).toBe(false);
    expect(detector.isCurrentlyPaused()).toBe(false);
    expect(detector.getTotalPauseDuration()).toBe(0);
  });

  it('reports a pause after 60 s and counts the whole standing time', () => {
    const detector = new PauseDetector();
    detector.checkPause(0.1, 5);
    now += 60_000;
    expect(detector.checkPause(0.1, 5)).toBe(true);
    expect(detector.isCurrentlyPaused()).toBe(true);
    now += 30_000;
    expect(detector.getTotalPauseDuration()).toBe(90_000);
  });

  it('treats missing speed and accuracy as standing still', () => {
    const detector = new PauseDetector();
    detector.checkPause(null, null);
    now += 60_000;
    expect(detector.checkPause(null, null)).toBe(true);
  });

  it('accumulates pauses across movement', () => {
    const detector = new PauseDetector();
    detector.checkPause(0, 5);
    now += 70_000;
    detector.checkPause(0, 5);
    expect(detector.checkPause(1.2, 5)).toBe(false);
    expect(detector.isCurrentlyPaused()).toBe(false);
    expect(detector.getTotalPauseDuration()).toBe(70_000);

    detector.checkPause(0, 5);
    now += 80_000;
    detector.checkPause(0, 5);
    detector.checkPause(1.2, 5);
    expect(detector.getTotalPauseDuration()).toBe(150_000);
  });

  it('does not count short stops that never became a pause', () => {
    const detector = new PauseDetector();
    detector.checkPause(0, 5);
    now += 30_000;
    detector.checkPause(1.2, 5);
    expect(detector.getTotalPauseDuration()).toBe(0);
  });

  it('ignores standing still with poor GPS accuracy', () => {
    const detector = new PauseDetector();
    detector.checkPause(0, 25);
    now += 120_000;
    expect(detector.checkPause(0, 25)).toBe(false);
  });

  it('reset clears all state', () => {
    const detector = new PauseDetector();
    detector.checkPause(0, 5);
    now += 70_000;
    detector.checkPause(0, 5);
    detector.reset();
    expect(detector.isCurrentlyPaused()).toBe(false);
    expect(detector.getTotalPauseDuration()).toBe(0);
  });
});
