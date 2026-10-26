// __tests__/useRecordingDetail.test.ts
// Unit tests for useDeleteRecording in hooks/useRecordingDetail.
//
// React and React Query are mocked so the hook can be called directly without
// renderHook (style of useRecordingVisibility.test.ts); the Supabase client
// records the delete and its filters and returns the configured error.

import { useDeleteRecording } from '../hooks/useRecordingDetail';
import { showErrorToast } from '../lib/toast';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  op: string | null;
  filters: [string, unknown][];
}

const mockRecorded: RecordedQuery[] = [];
let mockError: { code: string; message: string } | null = null;
let mockUserId: string | null = 'me';
const mockInvalidate = jest.fn();

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: null, filters: [] };
  mockRecorded.push(query);
  const builder = {
    delete: () => { query.op = 'delete'; return builder; },
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

jest.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (v: unknown) => ({ current: v }),
  useState: (v: unknown) => [v, () => undefined],
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
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

describe('useDeleteRecording', () => {
  it('deletes filtered on id and user_id and invalidates the profile stats', async () => {
    await expect(useDeleteRecording().deleteRecording('rec-1')).resolves.toBe(true);

    expect(mockRecorded).toEqual([
      { table: 'recordings', op: 'delete', filters: [['id', 'rec-1'], ['user_id', 'me']] },
    ]);
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['profile-stats', 'me'] });
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('returns false and shows a toast when the delete fails', async () => {
    mockError = { code: '42501', message: 'row-level security' };

    await expect(useDeleteRecording().deleteRecording('rec-1')).resolves.toBe(false);

    expect(showErrorToast).toHaveBeenCalledWith('Die Tour konnte nicht gelöscht werden.');
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('ignores a second call while deleting', async () => {
    const { deleteRecording } = useDeleteRecording();

    const results = await Promise.all([deleteRecording('rec-1'), deleteRecording('rec-1')]);

    expect(results).toEqual([true, false]);
    expect(mockRecorded).toHaveLength(1);
  });

  it('does not delete without a signed-in user', async () => {
    mockUserId = null;

    await expect(useDeleteRecording().deleteRecording('rec-1')).resolves.toBe(false);

    expect(mockRecorded).toHaveLength(0);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
