// __tests__/routeRow.test.ts
// Unit tests for lib/routeRow: building the `routes` row from a RouteResult
// and saving it together with the bookmark (rollback if bookmarking fails).

import { buildRouteInsertRow, saveRouteWithBookmark } from '../lib/routeRow';
import type { RouteResult } from '../hooks/useRouting';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  op: 'insert' | 'delete' | null;
  values: unknown;
  eq: [string, unknown] | null;
}

const mockRecorded: RecordedQuery[] = [];
let mockBookmarkError: { code: string; message: string } | null = null;

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: null, values: null, eq: null };
  mockRecorded.push(query);
  const result = () =>
    Promise.resolve({ data: null, error: table === 'route_bookmarks' ? mockBookmarkError : null });
  const builder = {
    insert: (v: unknown) => {
      query.op = 'insert';
      query.values = v;
      return Object.assign(result(), builder);
    },
    delete: () => { query.op = 'delete'; return builder; },
    eq: (col: string, val: unknown) => { query.eq = [col, val]; return result(); },
    select: () => builder,
    single: () => Promise.resolve({ data: { id: 'route-1' }, error: null }),
  };
  return builder;
}

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockMakeBuilder(table) },
}));

function makeResult(coordinates: number[][], overrides: Partial<RouteResult> = {}): RouteResult {
  return {
    geojson: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
      ],
    },
    distance_m: 5200,
    elevation_gain_m: 410,
    elevation_loss_m: 120,
    estimated_duration_min: 95.5,
    sac_scale: 'T2',
    max_elevation_m: 1820,
    elevationProfile: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockRecorded.length = 0;
  mockBookmarkError = null;
});

// ─── buildRouteInsertRow ──────────────────────────────────────────────────────

describe('buildRouteInsertRow', () => {
  const now = new Date(2026, 9, 25, 14, 30);

  it('builds a 2D private row with rounded duration and dated title', () => {
    const row = buildRouteInsertRow(
      makeResult([[8.5, 46.9, 1200], [8.51, 46.91, 1300], [NaN, 46.92, 1400]]),
      'me',
      now,
    );
    expect(row.geom).toEqual({ type: 'LineString', coordinates: [[8.5, 46.9], [8.51, 46.91]] });
    expect(row.title).toBe('Eigene Route, 25.10.2026');
    expect(row.estimated_duration_min).toBe(96);
    expect(row.user_id).toBe('me');
    expect(row.is_published).toBe(false);
    expect(row.is_curated).toBe(false);
    expect(row.sac_scale).toBe('T2');
  });

  it('throws without a LineString', () => {
    const result = makeResult([]);
    result.geojson.features = [result.geojson.features[0]];
    expect(() => buildRouteInsertRow(result, 'me', now)).toThrow('Route hat keine gültige Linie.');
  });

  it('throws with only one point', () => {
    expect(() => buildRouteInsertRow(makeResult([[8.5, 46.9, 1200]]), 'me', now)).toThrow(
      'Route hat keine gültige Linie.',
    );
  });
});

// ─── saveRouteWithBookmark ────────────────────────────────────────────────────

describe('saveRouteWithBookmark', () => {
  const row = buildRouteInsertRow(makeResult([[8.5, 46.9], [8.51, 46.91]]), 'me');

  it('inserts route and bookmark and returns the id', async () => {
    await expect(saveRouteWithBookmark(row, 'me')).resolves.toBe('route-1');
    expect(mockRecorded.map((q) => [q.table, q.op])).toEqual([
      ['routes', 'insert'],
      ['route_bookmarks', 'insert'],
    ]);
    expect(mockRecorded[0].values).toBe(row);
    expect(mockRecorded[1].values).toEqual({ user_id: 'me', route_id: 'route-1' });
  });

  it('deletes the route again and throws when bookmarking fails', async () => {
    mockBookmarkError = { code: '42501', message: 'denied' };
    await expect(saveRouteWithBookmark(row, 'me')).rejects.toBe(mockBookmarkError);
    expect(mockRecorded.map((q) => [q.table, q.op])).toEqual([
      ['routes', 'insert'],
      ['route_bookmarks', 'insert'],
      ['routes', 'delete'],
    ]);
    expect(mockRecorded[2].eq).toEqual(['id', 'route-1']);
  });
});
