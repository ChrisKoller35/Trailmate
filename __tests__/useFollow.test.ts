// __tests__/useFollow.test.ts
// Unit tests for follow, acceptFollowRequest and rejectFollowRequest in
// hooks/useFollow (Migration 018: private Profile nur per Anfrage).
//
// React Query is mocked so the hook can be called directly without
// renderHook: useMutation runs onMutate → mutationFn → onError/onSettled like
// the real implementation, and the Supabase client records every query.

import { useFollow } from '../hooks/useFollow';
import { showErrorToast } from '../lib/toast';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  op: 'insert' | 'update' | 'delete' | 'select';
  values: unknown;
  filters: Record<string, string>;
}

const mockRecorded: RecordedQuery[] = [];
// Zeile, die das Lesen von users liefert (null = durch RLS verborgen)
let mockTargetRow: { is_private: boolean } | null = null;
let mockErrorFor: ((q: RecordedQuery) => { code: string; message: string } | null) | null = null;

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: 'select', values: null, filters: {} };
  mockRecorded.push(query);
  const result = () => ({
    data: table === 'users' ? mockTargetRow : null,
    error: mockErrorFor?.(query) ?? null,
  });
  const builder = {
    insert: (v: unknown) => { query.op = 'insert'; query.values = v; return builder; },
    update: (v: unknown) => { query.op = 'update'; query.values = v; return builder; },
    delete: () => { query.op = 'delete'; return builder; },
    select: () => builder,
    order: () => builder,
    eq: (col: string, val: string) => { query.filters[col] = val; return builder; },
    maybeSingle: () => Promise.resolve(result()),
    then: (resolve: (r: ReturnType<typeof result>) => void) => resolve(result()),
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
  mockTargetRow = null;
  mockErrorFor = null;
  jest.clearAllMocks();
});

const writes = () => mockRecorded.filter((q) => q.op !== 'select');

describe('useFollow.follow', () => {
  it('sends a request when the profile is hidden (private, not followed)', async () => {
    mockTargetRow = null;

    await useFollow().follow('other');

    expect(writes()).toEqual([
      {
        table: 'follow_requests',
        op: 'insert',
        values: { requester_id: 'me', target_id: 'other', status: 'pending' },
        filters: {},
      },
    ]);
  });

  it('sends a request when the profile is visible and private', async () => {
    mockTargetRow = { is_private: true };

    await useFollow().follow('other');

    expect(writes().map((q) => q.table)).toEqual(['follow_requests']);
  });

  it('follows a public profile directly', async () => {
    mockTargetRow = { is_private: false };

    await useFollow().follow('other');

    expect(writes()).toEqual([
      {
        table: 'follows',
        op: 'insert',
        values: { follower_id: 'me', following_id: 'other' },
        filters: {},
      },
    ]);
  });

  it('treats an already pending request as success', async () => {
    mockErrorFor = (q) =>
      q.table === 'follow_requests' && q.op === 'insert'
        ? { code: '23505', message: 'duplicate key' }
        : null;

    await expect(useFollow().follow('other')).resolves.toBeUndefined();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('shows a toast when the request fails for another reason', async () => {
    mockErrorFor = (q) =>
      q.table === 'follow_requests' && q.op === 'insert'
        ? { code: '42501', message: 'row-level security' }
        : null;

    await expect(useFollow().follow('other')).rejects.toBeTruthy();
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });
});

describe('useFollow.acceptFollowRequest', () => {
  it('only sets the status; the server creates the follow', async () => {
    await useFollow().acceptFollowRequest('fan');

    expect(writes()).toEqual([
      {
        table: 'follow_requests',
        op: 'update',
        values: { status: 'accepted' },
        filters: { requester_id: 'fan', target_id: 'me', status: 'pending' },
      },
    ]);
  });
});

describe('useFollow.rejectFollowRequest', () => {
  it('deletes the pending request so a new one stays possible', async () => {
    await useFollow().rejectFollowRequest('fan');

    expect(writes()).toEqual([
      {
        table: 'follow_requests',
        op: 'delete',
        values: null,
        filters: { requester_id: 'fan', target_id: 'me', status: 'pending' },
      },
    ]);
  });
});
