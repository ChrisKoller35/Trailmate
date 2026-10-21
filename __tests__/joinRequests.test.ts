// __tests__/joinRequests.test.ts
// Unit tests for approving and rejecting join requests in hooks/useGroups
// and hooks/useCommunities (manageCommunity).
//
// React and React Query are mocked so the hooks can be called directly
// without renderHook; the Supabase client records every query in order.

import { useGroups } from '../hooks/useGroups';
import { useCommunities } from '../hooks/useCommunities';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  op: 'insert' | 'update' | 'select';
  payload: Record<string, string> | null;
  filters: Record<string, string>;
}

type MockError = { message: string; code?: string } | null;

const mockRecorded: RecordedQuery[] = [];
let mockErrorFor: ((q: RecordedQuery) => MockError) | null = null;

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: 'select', payload: null, filters: {} };
  mockRecorded.push(query);
  const builder = {
    insert: (p: Record<string, string>) => { query.op = 'insert'; query.payload = p; return builder; },
    update: (p: Record<string, string>) => { query.op = 'update'; query.payload = p; return builder; },
    select: () => builder,
    eq: (col: string, val: string) => { query.filters[col] = val; return builder; },
    then: (resolve: (r: { data: null; error: MockError }) => void) =>
      resolve({ data: null, error: mockErrorFor?.(query) ?? null }),
  };
  return builder;
}

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockMakeBuilder(table) },
}));

jest.mock('../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string }; profile: null }) => unknown) =>
    sel({ user: { id: 'me' }, profile: null }),
}));

jest.mock('react', () => ({
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQuery: () => ({ data: [], refetch: jest.fn() }),
  useMutation: () => ({ mutateAsync: jest.fn() }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecorded.length = 0;
  mockErrorFor = null;
});

function useJoinRequestApi(kind: 'group' | 'community') {
  const groups = useGroups();
  const { manageCommunity } = useCommunities();
  return kind === 'group' ? groups : manageCommunity;
}

const variants = [
  {
    name: 'useGroups',
    kind: 'group' as const,
    members: 'group_members',
    requests: 'group_join_requests',
    key: 'group_id',
  },
  {
    name: 'useCommunities',
    kind: 'community' as const,
    members: 'community_members',
    requests: 'community_join_requests',
    key: 'community_id',
  },
];

describe.each(variants)('$name join requests', (v) => {
  let approve: (id: string, u: string) => Promise<void>;
  let reject: (id: string, u: string) => Promise<void>;

  beforeEach(() => {
    const api = useJoinRequestApi(v.kind);
    approve = api.approveJoinRequest;
    reject = api.rejectJoinRequest;
    mockRecorded.length = 0;
  });

  it('approve inserts the member first, then marks the request accepted', async () => {
    await approve('g1', 'other');

    expect(mockRecorded.map((q) => `${q.op}:${q.table}`)).toEqual([
      `insert:${v.members}`,
      `update:${v.requests}`,
    ]);
    expect(mockRecorded[0].payload).toEqual({ [v.key]: 'g1', user_id: 'other', role: 'member' });
    expect(mockRecorded[1]).toMatchObject({
      payload: { status: 'accepted' },
      filters: { [v.key]: 'g1', user_id: 'other', status: 'pending' },
    });
  });

  it('approve throws and leaves the request pending when inserting fails', async () => {
    mockErrorFor = (q) => (q.op === 'insert' ? { message: 'denied', code: '42501' } : null);

    await expect(approve('g1', 'other')).rejects.toThrow('denied');
    expect(mockRecorded.filter((q) => q.op === 'update')).toHaveLength(0);
  });

  it('approve treats an existing membership as success', async () => {
    mockErrorFor = (q) => (q.op === 'insert' ? { message: 'duplicate', code: '23505' } : null);

    await expect(approve('g1', 'other')).resolves.toBeUndefined();
    expect(mockRecorded[1]).toMatchObject({ op: 'update', payload: { status: 'accepted' } });
  });

  it('approve throws when closing the request fails', async () => {
    mockErrorFor = (q) => (q.op === 'update' ? { message: 'boom' } : null);

    await expect(approve('g1', 'other')).rejects.toThrow('boom');
  });

  it('reject only marks the request rejected', async () => {
    await reject('g1', 'other');

    expect(mockRecorded).toEqual([
      {
        table: v.requests,
        op: 'update',
        payload: { status: 'rejected' },
        filters: { [v.key]: 'g1', user_id: 'other', status: 'pending' },
      },
    ]);
  });

  it('reject throws on error', async () => {
    mockErrorFor = () => ({ message: 'boom' });

    await expect(reject('g1', 'other')).rejects.toThrow('boom');
  });
});
