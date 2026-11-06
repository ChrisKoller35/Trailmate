// __tests__/useHighlightTours.test.ts
// Unit tests for useSaveHighlights. React and React Query are mocked so the
// hook can be called directly (style of useRecordingVisibility.test.ts); the
// Supabase client records every builder call per query.

import { useSaveHighlights } from '../hooks/useHighlightTours';
import { showErrorToast } from '../lib/toast';

const mockQueries: unknown[][][] = [];
let mockUpsertError: { message: string } | null = null;
const mockInvalidate = jest.fn();

function mockMakeBuilder() {
  const calls: unknown[][] = [];
  mockQueries.push(calls);
  const record = (name: string) => (...args: unknown[]) => { calls.push([name, ...args]); return builder; };
  const builder = {
    upsert: record('upsert'), delete: record('delete'), eq: record('eq'), not: record('not'),
    then: (resolve: (r: { error: unknown }) => unknown) =>
      resolve({ error: calls[0][0] === 'upsert' ? mockUpsertError : null }),
  };
  return builder;
}

jest.mock('../lib/supabase', () => ({ supabase: { from: () => mockMakeBuilder() } }));
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

beforeEach(() => {
  mockQueries.length = 0;
  mockUpsertError = null;
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useSaveHighlights', () => {
  it('upserts in order, deletes the rest and invalidates both keys', async () => {
    await expect(useSaveHighlights().saveHighlights(['a', 'b'])).resolves.toBe(true);

    expect(mockQueries).toEqual([
      [['upsert', [
        { user_id: 'me', recording_id: 'a', sort_order: 0 },
        { user_id: 'me', recording_id: 'b', sort_order: 1 },
      ], { onConflict: 'user_id,recording_id' }]],
      [['delete'], ['eq', 'user_id', 'me'], ['not', 'recording_id', 'in', '(a,b)']],
    ]);
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['highlight-tours', 'me'] });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['highlight-editor', 'me'] });
  });

  it('deletes all own rows without upsert for an empty selection', async () => {
    await expect(useSaveHighlights().saveHighlights([])).resolves.toBe(true);

    expect(mockQueries).toEqual([[['delete'], ['eq', 'user_id', 'me']]]);
  });

  it('returns false, shows a toast and deletes nothing when the upsert fails', async () => {
    mockUpsertError = { message: 'row-level security' };

    await expect(useSaveHighlights().saveHighlights(['a'])).resolves.toBe(false);

    expect(mockQueries).toHaveLength(1);
    expect(showErrorToast).toHaveBeenCalledWith('Die Highlight-Touren konnten nicht gespeichert werden.');
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
