// __tests__/useRecordingDetail.test.ts
// useDeleteRecording, direkt aufgerufen wie in useRecordingVisibility.test.ts:
// React und React Query gemockt, Supabase zeichnet Löschen und Filter auf.

import { useDeleteRecording } from '../hooks/useRecordingDetail';
import { showErrorToast } from '../lib/toast';

const mockRecorded: { table: string; op: string | null; filters: [string, unknown][] }[] = [];
let mockError: { message: string } | null = null;
let mockUserId: string | null = 'me';
const mockInvalidate = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query = { table, op: null as string | null, filters: [] as [string, unknown][] };
      mockRecorded.push(query);
      const builder = {
        delete: () => { query.op = 'delete'; return builder; },
        eq: (col: string, val: unknown) => { query.filters.push([col, val]); return builder; },
        then: (resolve: (r: { error: typeof mockError }) => unknown) => resolve({ error: mockError }),
      };
      return builder;
    },
  },
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
  });

  it('returns false and shows a toast when the delete fails', async () => {
    mockError = { message: 'row-level security' };
    await expect(useDeleteRecording().deleteRecording('rec-1')).resolves.toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith('Die Tour konnte nicht gelöscht werden.');
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it('ignores a second call while deleting', async () => {
    const { deleteRecording } = useDeleteRecording();
    await expect(Promise.all([deleteRecording('rec-1'), deleteRecording('rec-1')])).resolves.toEqual([true, false]);
    expect(mockRecorded).toHaveLength(1);
  });

  it('does not delete without a signed-in user', async () => {
    mockUserId = null;
    await expect(useDeleteRecording().deleteRecording('rec-1')).resolves.toBe(false);
    expect(mockRecorded).toHaveLength(0);
  });
});
