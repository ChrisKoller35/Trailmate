// __tests__/useLiveTracking.test.ts
// Sitzungsstart in hooks/useLiveTracking (Migration 021: Token vom Server).
//
// React Query is mocked so the hook can be called directly without
// renderHook, and the Supabase client records every query.

import { useStartLiveTracking } from '../hooks/useLiveTracking';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  op: 'insert' | 'update' | 'select';
  values: unknown;
  selected: boolean;
}

const mockRecorded: RecordedQuery[] = [];
const mockServerToken = '0123456789abcdef0123456789abcdef';

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: 'select', values: null, selected: false };
  mockRecorded.push(query);
  const builder = {
    insert: (v: unknown) => { query.op = 'insert'; query.values = v; return builder; },
    update: (v: unknown) => { query.op = 'update'; query.values = v; return builder; },
    select: () => { query.selected = true; return builder; },
    eq: () => builder,
    single: () =>
      Promise.resolve({
        data: { id: 's1', ...(query.values as object), share_token: mockServerToken },
        error: null,
      }),
  };
  return builder;
}

jest.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mockMakeBuilder(table) },
}));

jest.mock('../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string } }) => unknown) => sel({ user: { id: 'me' } }),
}));

const mockQueryClient = { invalidateQueries: jest.fn() };

interface MutationOptions {
  mutationFn: (v: unknown) => Promise<unknown>;
  onSuccess?: () => void;
}

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
  useQuery: () => ({ data: null }),
  useMutation: (opts: MutationOptions) => ({
    mutateAsync: async (v: unknown) => {
      const result = await opts.mutationFn(v);
      opts.onSuccess?.();
      return result;
    },
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecorded.length = 0;
  jest.clearAllMocks();
});

describe('useStartLiveTracking', () => {
  it('inserts without a client token and returns the token from the server', async () => {
    const session = (await useStartLiveTracking().mutateAsync({
      trusted_contacts: [{ name: 'Mami', phone: '079' }],
      expected_return: null,
      update_interval_minutes: 10,
    })) as { share_token: string };

    expect(mockRecorded).toHaveLength(1);
    const insert = mockRecorded[0];
    expect(insert.table).toBe('live_tracking_sessions');
    expect(insert.op).toBe('insert');
    expect(insert.selected).toBe(true);
    expect(insert.values).not.toHaveProperty('share_token');
    expect(insert.values).toEqual({
      user_id: 'me',
      trusted_contacts: [{ name: 'Mami', phone: '079' }],
      expected_return: null,
      update_interval_minutes: 10,
      is_active: true,
    });

    expect(session.share_token).toBe(mockServerToken);
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['live-tracking', 'me'],
    });
  });
});
