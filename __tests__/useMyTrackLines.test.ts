// Unit tests for hooks/useMyTrackLines.
//
// useQuery is mocked to return its options so the hook can be called directly
// (style of useRecordingVisibility.test.ts); the Supabase client records the
// select and its filters and returns the configured rows or error.

import { useMyTrackLines } from '../hooks/useMyTrackLines';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  calls: [string, ...unknown[]][];
}

const mockRecorded: RecordedQuery[] = [];
let mockData: { id: string; geom: unknown }[] | null = [];
let mockError: { code: string; message: string } | null = null;
let mockUserId: string | null = 'me';

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, calls: [] };
  mockRecorded.push(query);
  const builder: Record<string, unknown> = {
    then: (resolve: (r: { data: typeof mockData; error: typeof mockError }) => unknown) =>
      resolve({ data: mockError ? null : mockData, error: mockError }),
  };
  for (const name of ['select', 'eq', 'not', 'order', 'limit']) {
    builder[name] = (...args: unknown[]) => { query.calls.push([name, ...args]); return builder; };
  }
  return builder;
}

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockMakeBuilder(table) },
}));

jest.mock('../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) =>
    sel({ user: mockUserId ? { id: mockUserId } : null }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => options,
}));

interface Options {
  queryKey: unknown[];
  enabled: boolean;
  queryFn: () => Promise<{ count: number; collection: { features: { properties: { id: string } }[] } }>;
}


// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecorded.length = 0;
  mockData = [];
  mockError = null;
  mockUserId = 'me';
});

describe('useMyTrackLines', () => {
  it('is enabled only when asked and signed in', () => {
    expect(useMyTrackLines(true)).toMatchObject({ queryKey: ['my-track-lines', 'me'], enabled: true });
    expect(useMyTrackLines(false)).toMatchObject({ enabled: false });
    mockUserId = null;
    expect(useMyTrackLines(true)).toMatchObject({ enabled: false });
  });

  it('loads the own latest 50 recordings with a line, newest first', async () => {
    mockData = [{ id: 'r1', geom: { type: 'LineString', coordinates: [[8, 47], [8.1, 47.1]] } }];

    const result = await (useMyTrackLines(true) as unknown as Options).queryFn();

    expect(mockRecorded).toEqual([{
      table: 'recordings',
      calls: [
        ['select', 'id, geom'],
        ['eq', 'user_id', 'me'],
        ['not', 'geom', 'is', null],
        ['order', 'started_at', { ascending: false }],
        ['limit', 50],
      ],
    }]);
    expect(result.count).toBe(1);
    expect(result.collection.features[0].properties.id).toBe('r1');
  });

  it('throws when the query fails', async () => {
    mockError = { code: '500', message: 'boom' };
    await expect((useMyTrackLines(true) as unknown as Options).queryFn()).rejects.toEqual(mockError);
  });
});
