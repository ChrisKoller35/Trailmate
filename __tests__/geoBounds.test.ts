// __tests__/geoBounds.test.ts
// Unit tests for lib/geoBounds.

import { lineBounds } from '../lib/geoBounds';

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
