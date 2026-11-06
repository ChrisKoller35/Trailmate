// Unit tests for lib/trackCollection.

import { buildTrackCollection } from '../lib/trackCollection';

describe('buildTrackCollection', () => {
  it('builds features with ids, drops invalid lines and spans all lines', () => {
    const withCrs = {
      type: 'LineString',
      crs: { type: 'name', properties: { name: 'EPSG:4326' } },
      coordinates: [[8.5, 47.3], [8.6, 47.4]],
    };
    const asText = JSON.stringify({ type: 'LineString', coordinates: [[7.4, 46.9], [7.5, 46.95]] });

    const result = buildTrackCollection([
      { id: 'a', geom: withCrs },
      { id: 'b', geom: asText },
      { id: 'c', geom: null },
      { id: 'd', geom: { type: 'LineString', coordinates: [[8, 47]] } },
    ]);

    expect(result.count).toBe(2);
    expect(result.collection.type).toBe('FeatureCollection');
    expect(result.collection.features.map((f) => f.properties.id)).toEqual(['a', 'b']);
    expect(result.collection.features[0].geometry.coordinates).toEqual([[8.5, 47.3], [8.6, 47.4]]);
    expect(result.bounds).toEqual({ ne: [8.6, 47.4], sw: [7.4, 46.9] });
  });

  it('thins dense lines but keeps the first and last point', () => {
    // 200 Punkte im Abstand von 1 m (0.000009° Breite ≈ 1 m).
    const coordinates = Array.from({ length: 200 }, (_, i) => [8, 47 + i * 0.000009]);
    const result = buildTrackCollection([{ id: 'x', geom: { type: 'LineString', coordinates } }]);

    const kept = result.collection.features[0].geometry.coordinates;
    expect(kept.length).toBeLessThan(15);
    expect(kept[0]).toEqual(coordinates[0]);
    expect(kept[kept.length - 1]).toEqual(coordinates[199]);
  });

  it('returns an empty collection without bounds for no rows', () => {
    const result = buildTrackCollection([]);
    expect(result.count).toBe(0);
    expect(result.bounds).toBeNull();
    expect(result.collection.features).toEqual([]);
  });
});
