// __tests__/useBlock.test.ts
// Unit tests for blockUser in hooks/useBlock.
//
// React Query and React are mocked so the hook can be called directly without
// renderHook: useMutation runs onMutate → mutationFn → onError/onSettled like
// the real implementation, and the Supabase client records every query.

import { useBlock } from '../hooks/useBlock';
import { showErrorToast } from '../lib/toast';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  op: 'insert' | 'delete' | 'select';
  filters: Record<string, string>;
}

const mockRecorded: RecordedQuery[] = [];
let mockFailOn: ((q: RecordedQuery) => boolean) | null = null;

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: 'select', filters: {} };
  mockRecorded.push(query);
  const builder = {
    insert: () => { query.op = 'insert'; return builder; },
    delete: () => { query.op = 'delete'; return builder; },
    select: () => builder,
    order: () => builder,
    eq: (col: string, val: string) => { query.filters[col] = val; return builder; },
    then: (resolve: (r: { data: null; error: { message: string } | null }) => void) =>
      resolve({ data: null, error: mockFailOn?.(query) ? { message: 'boom' } : null }),
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

jest.mock('react', () => ({ useMemo: (fn: () => unknown) => fn() }));

const mockQueryClient = {
  cancelQueries: jest.fn(),
  getQueryData: jest.fn(() => []),
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
};

interface MutationOptions {
  mutationFn: (v: string) => Promise<unknown>;
  onMutate?: (v: string) => Promise<unknown>;
  onError?: (e: unknown, v: string, ctx: unknown) => void;
  onSettled?: () => void;
}

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
  useQuery: () => ({ data: [], refetch: jest.fn() }),
  useMutation: (opts: MutationOptions) => ({
    mutateAsync: async (v: string) => {
      const ctx = await opts.onMutate?.(v);
      try {
        return await opts.mutationFn(v);
      } catch (e) {
        opts.onError?.(e, v, ctx);
        throw e;
      } finally {
        opts.onSettled?.();
      }
    },
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecorded.length = 0;
  mockFailOn = null;
  jest.clearAllMocks();
});

const deletes = () => mockRecorded.filter((q) => q.op === 'delete');

describe('useBlock.blockUser', () => {
  it('inserts the block and deletes follows in both directions', async () => {
    await useBlock().blockUser('other');

    expect(mockRecorded).toContainEqual({
      table: 'blocks',
      op: 'insert',
      filters: {},
    });
    expect(deletes()).toEqual(
      expect.arrayContaining([
        { table: 'follows', op: 'delete', filters: { follower_id: 'me', following_id: 'other' } },
        { table: 'follows', op: 'delete', filters: { follower_id: 'other', following_id: 'me' } },
        { table: 'follow_requests', op: 'delete', filters: { requester_id: 'me', target_id: 'other' } },
        { table: 'follow_requests', op: 'delete', filters: { requester_id: 'other', target_id: 'me' } },
      ]),
    );
    expect(showErrorToast).not.toHaveBeenCalled();
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['followers'] });
  });

  it('shows a toast and skips cleanup when the block insert fails', async () => {
    mockFailOn = (q) => q.table === 'blocks' && q.op === 'insert';

    await expect(useBlock().blockUser('other')).rejects.toBeTruthy();

    expect(deletes()).toHaveLength(0);
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('shows a toast when deleting a follow relation fails', async () => {
    mockFailOn = (q) => q.table === 'follows' && q.filters.follower_id === 'other';

    await expect(useBlock().blockUser('other')).rejects.toBeTruthy();

    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });
});
