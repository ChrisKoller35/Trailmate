// __tests__/recordingLine.test.ts
import { recordingLineFeature } from '../lib/recordingLine';

const geom = {
  type: 'LineString',
  crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  coordinates: [[7.5, 46.9, 540], ['x', 1], [7.6, 46.8, 610]],
};

describe('recordingLineFeature', () => {
  it('turns GeoJSON with crs and elevation into a 2D feature, also as JSON text', () => {
    const expected = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[7.5, 46.9], [7.6, 46.8]] },
    };
    expect(recordingLineFeature(geom)).toEqual(expected);
    expect(recordingLineFeature(JSON.stringify(geom))).toEqual(expected);
  });

  it.each([
    ['a single point', { type: 'LineString', coordinates: [[7.5, 46.9]] }],
    ['null', null],
    ['text without JSON', 'kein JSON'],
    ['a Point', { type: 'Point', coordinates: [7.5, 46.9] }],
  ])('returns null for %s', (_label, value) => {
    expect(recordingLineFeature(value)).toBeNull();
  });
});
