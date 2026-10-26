// __tests__/stepCounter.test.ts
// Unit tests for lib/stepCounter (Schritte über Pausen hinweg).

import { totalSteps } from '../lib/stepCounter';

describe('totalSteps', () => {
  it('zählt 100 Schritte, Pause, 100 Schritte zu 200', () => {
    const beforePause = totalSteps(0, 100);
    expect(beforePause).toBe(100);
    // Nach dem Fortsetzen zählt das neue Abo wieder ab 0
    expect(totalSteps(beforePause, 0)).toBe(100);
    expect(totalSteps(beforePause, 100)).toBe(200);
  });

  it('ergibt bei ungültigen Werten keine negativen Schritte', () => {
    expect(totalSteps(-50, 10)).toBe(10);
    expect(totalSteps(20, -5)).toBe(20);
    expect(totalSteps(Number.NaN, Number.POSITIVE_INFINITY)).toBe(0);
    expect(totalSteps(undefined as unknown as number, 7)).toBe(7);
  });
});
