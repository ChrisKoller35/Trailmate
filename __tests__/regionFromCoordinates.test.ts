import { REGIONS } from '../constants';
import { REGION_CENTERS, regionFromCoordinates } from '../lib/regionFromCoordinates';

describe('regionFromCoordinates', () => {
  it.each([
    { name: 'Interlaken', lat: 46.686, lng: 7.863, expected: 'Berner Oberland' },
    { name: 'Zermatt', lat: 46.02, lng: 7.749, expected: 'Wallis' },
    { name: 'St. Moritz', lat: 46.498, lng: 9.839, expected: 'Graubünden / Engadin' },
    { name: 'Luzern', lat: 47.05, lng: 8.309, expected: 'Zentralschweiz' },
    { name: 'St. Gallen', lat: 47.424, lng: 9.377, expected: 'Ostschweiz' },
    { name: 'Lugano', lat: 46.004, lng: 8.951, expected: 'Tessin' },
    { name: 'Zürich', lat: 47.378, lng: 8.54, expected: 'Zürich & Umgebung' },
    { name: 'Basel', lat: 47.558, lng: 7.588, expected: 'Basel & Umgebung' },
    { name: 'Langnau im Emmental', lat: 46.94, lng: 7.787, expected: 'Emmental' },
    { name: 'Fribourg', lat: 46.806, lng: 7.162, expected: 'Fribourg / Freiburg' },
    { name: 'Delémont', lat: 47.365, lng: 7.344, expected: 'Jura' },
  ])('$name → $expected', ({ lat, lng, expected }) => {
    expect(regionFromCoordinates(lat, lng)).toBe(expected);
  });

  it('gibt ausserhalb der Schweiz null zurück (Paris)', () => {
    expect(regionFromCoordinates(48.857, 2.352)).toBeNull();
  });

  it('gibt bei ungültigen Zahlen null zurück', () => {
    expect(regionFromCoordinates(NaN, 7.8)).toBeNull();
    expect(regionFromCoordinates(46.6, NaN)).toBeNull();
  });

  it('hat für jede Region einen Mittelpunkt', () => {
    for (const region of REGIONS) {
      expect(REGION_CENTERS[region]).toBeDefined();
    }
    expect(Object.keys(REGION_CENTERS)).toHaveLength(REGIONS.length);
  });
});
