// __tests__/usePublishRecording.test.ts
// Unit tests for hooks/usePublishRecording.
//
// React and React Query are mocked so the hook can be called directly without
// renderHook (style of useRecordingVisibility.test.ts); the Supabase client
// records every query with its values and filters.

import { usePublishRecording } from '../hooks/usePublishRecording';
import { showErrorToast, showSuccessToast } from '../lib/toast';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  op: string;
  values: unknown;
  filters: [string, unknown][];
}

const mockRecorded: RecordedQuery[] = [];
let mockUpdateError: { code: string; message: string } | null = null;
let mockUserId: string | null = 'me';
const mockInvalidate = jest.fn();

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: '', values: null, filters: [] };
  mockRecorded.push(query);
  const builder = {
    insert: (v: unknown) => { query.op = 'insert'; query.values = v; return builder; },
    update: (v: unknown) => { query.op = 'update'; query.values = v; return builder; },
    delete: () => { query.op = 'delete'; return builder; },
    select: () => builder,
    eq: (col: string, val: unknown) => { query.filters.push([col, val]); return builder; },
    single: () => Promise.resolve({ data: { id: 'route-1' }, error: null }),
    then: (resolve: (r: { error: typeof mockUpdateError }) => unknown) =>
      resolve({ error: query.op === 'update' ? mockUpdateError : null }),
  };
  return builder;
}

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockMakeBuilder(table) },
}));

jest.mock('../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) =>
    sel({ user: mockUserId ? { id: mockUserId } : null }),
}));

jest.mock('../lib/toast', () => ({ showErrorToast: jest.fn(), showSuccessToast: jest.fn() }));
jest.mock('../lib/brouterService', () => ({ calculateHikingRoute: jest.fn() }));

jest.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, () => undefined],
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

const recording = {
  id: 'rec-1',
  title: 'Harder Kulm',
  started_at: '2026-10-12T08:30:00Z',
  distance_m: 5000,
  elevation_gain_m: 700,
  elevation_loss_m: 100,
  geom: { type: 'LineString', coordinates: [[7.863, 46.686, 570], [7.88, 46.7, 700]] },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecorded.length = 0;
  mockUpdateError = null;
  mockUserId = 'me';
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('usePublishRecording', () => {
  it('inserts the route, links the recording and invalidates it', async () => {
    await expect(usePublishRecording().publishRecording(recording)).resolves.toBe('route-1');

    expect(mockRecorded).toHaveLength(2);
    expect(mockRecorded[0]).toMatchObject({ table: 'routes', op: 'insert' });
    expect(mockRecorded[0].values).toMatchObject({ user_id: 'me', is_published: true, title: 'Harder Kulm' });
    expect(mockRecorded[1]).toEqual({
      table: 'recordings',
      op: 'update',
      values: { route_id: 'route-1' },
      filters: [['id', 'rec-1'], ['user_id', 'me']],
    });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['recording', 'rec-1'] });
    expect(showSuccessToast).toHaveBeenCalledWith('Route veröffentlicht. Andere finden sie jetzt in Entdecken.');
  });

  it('deletes the route again and returns null when linking fails', async () => {
    mockUpdateError = { code: '42501', message: 'row-level security' };

    await expect(usePublishRecording().publishRecording(recording)).resolves.toBeNull();

    expect(mockRecorded[2]).toEqual({ table: 'routes', op: 'delete', values: null, filters: [['id', 'route-1']] });
    expect(showErrorToast).toHaveBeenCalledWith('Die Tour konnte nicht veröffentlicht werden.');
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('does nothing without a signed-in user', async () => {
    mockUserId = null;

    await expect(usePublishRecording().publishRecording(recording)).resolves.toBeNull();

    expect(mockRecorded).toHaveLength(0);
  });
});
