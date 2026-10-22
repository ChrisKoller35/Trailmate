// __tests__/useProfileCards.test.ts
// Unit tests for fetchProfileCards, searchProfiles and useProfileSearch in
// hooks/useProfileCards (Migration 019: Profilkarten und Personensuche).
//
// React Query is mocked so the hook can be called directly without
// renderHook, and the Supabase client records every RPC call.

import { fetchProfileCards, searchProfiles, useProfileSearch } from '../hooks/useProfileCards';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedRpc {
  fn: string;
  args: Record<string, unknown>;
}

const mockRpcCalls: RecordedRpc[] = [];
let mockRpcResult: { data: unknown; error: { code: string; message: string } | null } = {
  data: [],
  error: null,
};

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      mockRpcCalls.push({ fn, args });
      return Promise.resolve(mockRpcResult);
    },
  },
}));

jest.mock('../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string } }) => unknown) => sel({ user: { id: 'me' } }),
}));

interface QueryOptions {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  enabled: boolean;
}

let mockLastQuery: QueryOptions | null = null;

jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: QueryOptions) => {
    mockLastQuery = opts;
    return { data: undefined };
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

const card = {
  id: 'a',
  username: 'anna',
  display_name: 'Anna',
  avatar_url: null,
  is_private: true,
  is_verified: false,
};

beforeEach(() => {
  mockRpcCalls.length = 0;
  mockRpcResult = { data: [], error: null };
  mockLastQuery = null;
});

describe('fetchProfileCards', () => {
  it('loads all IDs with one RPC, without duplicates or empty IDs', async () => {
    mockRpcResult = { data: [card], error: null };

    const cards = await fetchProfileCards(['a', 'b', 'a', '', null, undefined, 'b', 'c']);

    expect(cards).toEqual([card]);
    expect(mockRpcCalls).toEqual([{ fn: 'get_profile_cards', args: { p_ids: ['a', 'b', 'c'] } }]);
  });

  it('makes no call for an empty list', async () => {
    await expect(fetchProfileCards([])).resolves.toEqual([]);
    await expect(fetchProfileCards(['', null])).resolves.toEqual([]);
    expect(mockRpcCalls).toEqual([]);
  });

  it('reports an RPC error', async () => {
    mockRpcResult = { data: null, error: { code: '42501', message: 'permission denied' } };

    await expect(fetchProfileCards(['a'])).rejects.toEqual(
      expect.objectContaining({ code: '42501' }),
    );
  });
});

describe('searchProfiles', () => {
  it('trims the query and calls search_profiles', async () => {
    mockRpcResult = { data: [card], error: null };

    await expect(searchProfiles('  an ')).resolves.toEqual([card]);
    expect(mockRpcCalls).toEqual([{ fn: 'search_profiles', args: { p_query: 'an' } }]);
  });

  it('makes no call below 2 characters', async () => {
    await expect(searchProfiles('')).resolves.toEqual([]);
    await expect(searchProfiles(' a  ')).resolves.toEqual([]);
    expect(mockRpcCalls).toEqual([]);
  });

  it('reports an RPC error', async () => {
    mockRpcResult = { data: null, error: { code: 'PGRST', message: 'kaputt' } };

    await expect(searchProfiles('anna')).rejects.toEqual(
      expect.objectContaining({ message: 'kaputt' }),
    );
  });
});

describe('useProfileSearch', () => {
  it('is disabled below 2 characters', () => {
    useProfileSearch(' a ');
    expect(mockLastQuery?.enabled).toBe(false);
    expect(mockRpcCalls).toEqual([]);
  });

  it('is enabled from 2 characters and searches the trimmed term', async () => {
    useProfileSearch(' An ');
    expect(mockLastQuery?.enabled).toBe(true);
    expect(mockLastQuery?.queryKey).toEqual(['profiles', 'search', 'me', 'an']);

    await mockLastQuery?.queryFn();
    expect(mockRpcCalls).toEqual([{ fn: 'search_profiles', args: { p_query: 'An' } }]);
  });
});
