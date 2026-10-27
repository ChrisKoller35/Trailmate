// __tests__/useHighlightTours.test.ts
// Unit tests for useSaveHighlights in hooks/useHighlightTours.
//
// React and React Query are mocked so the hook can be called directly (style
// of useRecordingVisibility.test.ts); the Supabase client records each call.

import { useSaveHighlights } from '../hooks/useHighlightTours';
import { showErrorToast } from '../lib/toast';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  calls: unknown[][];
}

const mockRecorded: RecordedQuery[] = [];
let mockUpsertError: { message: string } | null = null;
const mockInvalidate = jest.fn();

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, calls: [] };
  mockRecorded.push(query);
  let isUpsert = false;
  const record = (name: string) => (...args: unknown[]) => {
    query.calls.push([name, ...args]);
    if (name === 'upsert') isUpsert = true;
    return builder;
  };
  const builder = {
    upsert: record('upsert'),
    delete: record('delete'),
    eq: record('eq'),
    not: record('not'),
    then: (resolve: (r: { error: unknown }) => unknown) =>
      resolve({ error: isUpsert ? mockUpsertError : null }),
  };
  return builder;
}

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockMakeBuilder(table) },
}));

jest.mock('../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string } }) => unknown) => sel({ user: { id: 'me' } }),
}));

jest.mock('../lib/toast', () => ({ showErrorToast: jest.fn() }));

jest.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (v: unknown) => ({ current: v }),
  useState: (v: unknown) => [v, jest.fn()],
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecorded.length = 0;
  mockUpsertError = null;
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useSaveHighlights', () => {
  it('upserts in order, deletes the rest and invalidates both keys', async () => {
    await expect(useSaveHighlights().saveHighlights(['a', 'b'])).resolves.toBe(true);

    expect(mockRecorded).toHaveLength(2);
    expect(mockRecorded[0]).toEqual({
      table: 'highlight_tours',
      calls: [[
        'upsert',
        [
          { user_id: 'me', recording_id: 'a', sort_order: 0 },
          { user_id: 'me', recording_id: 'b', sort_order: 1 },
        ],
        { onConflict: 'user_id,recording_id' },
      ]],
    });
    expect(mockRecorded[1]).toEqual({
      table: 'highlight_tours',
      calls: [['delete'], ['eq', 'user_id', 'me'], ['not', 'recording_id', 'in', '(a,b)']],
    });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['highlight-tours', 'me'] });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['highlight-editor', 'me'] });
  });

  it('deletes all own rows without upsert for an empty selection', async () => {
    await expect(useSaveHighlights().saveHighlights([])).resolves.toBe(true);

    expect(mockRecorded).toHaveLength(1);
    expect(mockRecorded[0].calls).toEqual([['delete'], ['eq', 'user_id', 'me']]);
  });

  it('returns false, shows a toast and deletes nothing when the upsert fails', async () => {
    mockUpsertError = { message: 'row-level security' };

    await expect(useSaveHighlights().saveHighlights(['a'])).resolves.toBe(false);

    expect(mockRecorded).toHaveLength(1);
    expect(showErrorToast).toHaveBeenCalledWith('Die Highlight-Touren konnten nicht gespeichert werden.');
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
