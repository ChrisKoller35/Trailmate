// __tests__/geoBounds.test.ts
// Unit tests for lib/geoBounds.

import { boundsKey, lineBounds } from '../lib/geoBounds';

describe('lineBounds', () => {
  it('berechnet die Grenzen einer Linie mit 3D-Koordinaten', () => {
    const bounds = lineBounds([
      [7.5, 46.9, 540],
      [7.9, 46.6, 2100],
      [7.7, 46.8, 1200],
    ]);
    expect(bounds).toEqual({ ne: [7.9, 46.9], sw: [7.5, 46.6] });
  });

  it('ergibt null für eine leere Liste', () => {
    expect(lineBounds([])).toBeNull();
  });
});

describe('boundsKey', () => {
  it('ergibt für gleiche Grenzen denselben Schlüssel', () => {
    const a = lineBounds([[7.5, 46.6], [7.9, 46.9]]);
    const b = lineBounds([[7.9, 46.9, 2100], [7.5, 46.6, 540]]);
    expect(a).not.toBe(b);
    expect(boundsKey(a)).toBe(boundsKey(b));
  });

  it('ergibt für andere Grenzen einen anderen Schlüssel', () => {
    expect(boundsKey({ ne: [7.9, 46.9], sw: [7.5, 46.6] })).not.toBe(
      boundsKey({ ne: [7.9, 46.9], sw: [7.5, 46.5] }),
    );
  });

  it('ergibt null ohne Grenzen', () => {
    expect(boundsKey(null)).toBeNull();
    expect(boundsKey(undefined)).toBeNull();
  });
});
