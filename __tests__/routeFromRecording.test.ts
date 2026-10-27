// __tests__/routeFromRecording.test.ts
// Unit tests for lib/routeFromRecording.

import { buildRouteFromRecording, type RecordingRouteSource } from '../lib/routeFromRecording';
import { estimateDuration } from '../hooks/useRouting';

jest.mock('../lib/brouterService', () => ({ calculateHikingRoute: jest.fn() }));

const interlakenLine = {
  type: 'LineString',
  crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  coordinates: [
    [7.863, 46.686, 570],
    [7.87, 46.69, 620],
    [7.88, 46.7, 700],
  ],
};

function recording(overrides: Partial<RecordingRouteSource> = {}): RecordingRouteSource {
  return {
    title: '  Harder Kulm  ',
    started_at: '2026-10-12T08:30:00Z',
    distance_m: 5432,
    elevation_gain_m: 731,
    elevation_loss_m: 120,
    geom: interlakenLine,
    ...overrides,
  };
}

describe('buildRouteFromRecording', () => {
  it('drops crs and elevation and keeps 2D coordinates', () => {
    const row = buildRouteFromRecording(recording(), 'me');
    expect(row.geom).toEqual({
      type: 'LineString',
      coordinates: [[7.863, 46.686], [7.87, 46.69], [7.88, 46.7]],
    });
    expect(row.user_id).toBe('me');
    expect(row.title).toBe('Harder Kulm');
  });

  it('uses «Tour vom …» for an empty title', () => {
    const row = buildRouteFromRecording(recording({ title: '   ' }), 'me');
    expect(row.title).toBe('Tour vom 12.10.2026');
  });

  it('rounds the SAC duration to a whole number', () => {
    const row = buildRouteFromRecording(recording(), 'me');
    expect(Number.isInteger(row.estimated_duration_min)).toBe(true);
    expect(row.estimated_duration_min).toBe(Math.round(estimateDuration(5432, 731, 120)));
  });

  it('derives the region from the start point', () => {
    expect(buildRouteFromRecording(recording(), 'me').region).toBe('Berner Oberland');
    const paris = { type: 'LineString', coordinates: [[2.35, 48.86], [2.36, 48.87]] };
    expect(buildRouteFromRecording(recording({ geom: paris }), 'me').region).toBeNull();
  });

  it('publishes without curation and fills missing values with 0', () => {
    const row = buildRouteFromRecording(
      recording({ distance_m: null, elevation_gain_m: null, elevation_loss_m: null }),
      'me',
    );
    expect(row.is_published).toBe(true);
    expect(row.is_curated).toBe(false);
    expect(row).toMatchObject({ distance_m: 0, elevation_gain_m: 0, elevation_loss_m: 0, estimated_duration_min: 0 });
  });

  it('throws without a valid line', () => {
    expect(() => buildRouteFromRecording(recording({ geom: null }), 'me')).toThrow(
      'Die Tour hat keine gültige Linie.',
    );
  });
});
