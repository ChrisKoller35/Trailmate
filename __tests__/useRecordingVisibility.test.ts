// __tests__/useRecordingVisibility.test.ts
// Unit tests for hooks/useRecordingVisibility.
//
// React and React Query are mocked so the hook can be called directly without
// renderHook (style of useSaveRecording.test.ts); the Supabase client records
// the update and its filters and returns the configured error.

import { useRecordingVisibility } from '../hooks/useRecordingVisibility';
import { showErrorToast } from '../lib/toast';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  values: unknown;
  filters: [string, unknown][];
}

const mockRecorded: RecordedQuery[] = [];
let mockError: { code: string; message: string } | null = null;
let mockUserId: string | null = 'me';
const mockInvalidate = jest.fn();

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, values: null, filters: [] };
  mockRecorded.push(query);
  const builder = {
    update: (v: unknown) => { query.values = v; return builder; },
    eq: (col: string, val: unknown) => { query.filters.push([col, val]); return builder; },
    then: (resolve: (r: { error: typeof mockError }) => unknown) => resolve({ error: mockError }),
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

jest.mock('../lib/toast', () => ({ showErrorToast: jest.fn() }));

jest.mock('react', () => ({ useCallback: (fn: unknown) => fn }));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecorded.length = 0;
  mockError = null;
  mockUserId = 'me';
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useRecordingVisibility', () => {
  it('updates is_hidden filtered on id and user_id', async () => {
    await useRecordingVisibility().setHidden('rec-1', true);

    expect(mockRecorded).toHaveLength(1);
    expect(mockRecorded[0]).toEqual({
      table: 'recordings',
      values: { is_hidden: true },
      filters: [['id', 'rec-1'], ['user_id', 'me']],
    });
  });

  it('invalidates the profile stats and returns true on success', async () => {
    await expect(useRecordingVisibility().setHidden('rec-1', false)).resolves.toBe(true);

    expect(mockRecorded[0].values).toEqual({ is_hidden: false });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['profile-stats', 'me'] });
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('returns false and shows a toast when the update fails', async () => {
    mockError = { code: '42501', message: 'row-level security' };

    await expect(useRecordingVisibility().setHidden('rec-1', true)).resolves.toBe(false);

    expect(showErrorToast).toHaveBeenCalledWith('Die Tour konnte nicht geändert werden.');
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('does not update without a signed-in user', async () => {
    mockUserId = null;

    await expect(useRecordingVisibility().setHidden('rec-1', true)).resolves.toBe(false);

    expect(mockRecorded).toHaveLength(0);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
