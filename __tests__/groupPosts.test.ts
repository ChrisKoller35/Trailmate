// __tests__/groupPosts.test.ts
// Unit tests for fetchGroupPosts (hooks/useGroupPosts) and moderatePost /
// deletePost in hooks/usePostActions (Migration 020: Gruppen-Beiträge).
//
// React Query and React's memo hooks are mocked so the hooks can be called
// directly without renderHook; the Supabase client records every query.

import { fetchGroupPosts } from '../hooks/useGroupPosts';
import { usePostActions } from '../hooks/usePostActions';
import { showErrorToast } from '../lib/toast';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  op: 'insert' | 'update' | 'delete' | 'select';
  filters: Record<string, unknown>;
  order: string | null;
  range: [number, number] | null;
}

const mockRecorded: RecordedQuery[] = [];
let mockRows: Record<string, unknown[] | null> = {};
let mockError: { code: string; message: string } | null = null;

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: 'select', filters: {}, order: null, range: null };
  mockRecorded.push(query);
  const result = () => ({ data: mockRows[table] ?? [], error: mockError });
  const builder = {
    insert: () => { query.op = 'insert'; return builder; },
    update: () => { query.op = 'update'; return builder; },
    delete: () => { query.op = 'delete'; return builder; },
    select: () => builder,
    eq: (col: string, val: unknown) => { query.filters[col] = val; return builder; },
    is: (col: string, val: unknown) => { query.filters[col] = val; return builder; },
    in: (col: string, val: unknown) => { query.filters[col] = val; return builder; },
    order: (col: string) => { query.order = col; return builder; },
    range: (from: number, to: number) => { query.range = [from, to]; return builder; },
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

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
}));

const mockQueryClient = {
  cancelQueries: jest.fn(),
  getQueryData: jest.fn(() => []),
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
};

interface MutationOptions {
  mutationFn: (v: unknown) => Promise<unknown>;
  onSettled?: () => void;
}

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
  useQuery: () => ({ data: [] }),
  useInfiniteQuery: () => ({ data: undefined }),
  useMutation: (opts: MutationOptions) => ({
    mutateAsync: async (v: unknown) => {
      try {
        return await opts.mutationFn(v);
      } finally {
        opts.onSettled?.();
      }
    },
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockRecorded.length = 0;
  mockRows = {};
  mockError = null;
  jest.clearAllMocks();
});

const postRow = (id: string, userId: string) => ({
  id,
  user_id: userId,
  content: `Beitrag ${id}`,
  media_urls: null,
  route_id: null,
  location: null,
  group_id: 'g1',
  community_id: null,
  created_at: '2026-10-20T10:00:00Z',
  likes_count: 0,
  comments_count: 0,
  saves_count: 0,
  is_hidden: false,
});

describe('fetchGroupPosts', () => {
  it('filters on group_id, hides hidden posts, newest first, first page', async () => {
    mockRows = {
      posts: [postRow('p1', 'u1'), postRow('p2', 'u2')],
      users: [{ id: 'u1', username: 'anna', display_name: 'Anna', avatar_url: null }],
    };

    const page = await fetchGroupPosts({ type: 'group', id: 'g1' }, 0);

    const postsQuery = mockRecorded.find((q) => q.table === 'posts')!;
    expect(postsQuery.filters).toEqual({ group_id: 'g1', is_hidden: false });
    expect(postsQuery.order).toBe('created_at');
    expect(postsQuery.range).toEqual([0, 19]);

    const usersQuery = mockRecorded.find((q) => q.table === 'users')!;
    expect(usersQuery.filters).toEqual({ id: ['u1', 'u2'] });

    expect(page.posts.map((p) => [p.id, p.username])).toEqual([['p1', 'anna'], ['p2', 'Unknown']]);
    expect(page.hasMore).toBe(false);
    expect(page.nextOffset).toBe(20);
  });

  it('filters on community_id and pages by offset', async () => {
    mockRows = { posts: [] };

    const page = await fetchGroupPosts({ type: 'community', id: 'c1' }, 20);

    const postsQuery = mockRecorded.find((q) => q.table === 'posts')!;
    expect(postsQuery.filters).toEqual({ community_id: 'c1', is_hidden: false });
    expect(postsQuery.range).toEqual([20, 39]);
    // ohne Beiträge keine users-Abfrage
    expect(mockRecorded.map((q) => q.table)).toEqual(['posts']);
    expect(page.posts).toEqual([]);
  });

  it('throws when the posts query fails', async () => {
    mockError = { code: '42501', message: 'permission denied' };
    await expect(fetchGroupPosts({ type: 'group', id: 'g1' }, 0)).rejects.toEqual(mockError);
  });
});

describe('usePostActions.moderatePost', () => {
  const deletes = () => mockRecorded.filter((q) => q.op === 'delete');

  it('deletes a foreign post without a user_id filter', async () => {
    mockRows = { posts: [{ id: 'p1' }] };

    const ok = await usePostActions().moderatePost('p1');

    expect(ok).toBe(true);
    expect(deletes()).toEqual([
      expect.objectContaining({ table: 'posts', filters: { id: 'p1' } }),
    ]);
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['feed'] });
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('shows a toast when RLS deleted nothing (no moderator rights)', async () => {
    mockRows = { posts: [] };

    const ok = await usePostActions().moderatePost('p1');

    expect(ok).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith('Beitrag konnte nicht gelöscht werden.');
  });

  it('shows the database error as a toast', async () => {
    mockError = { code: '42501', message: 'permission denied' };

    const ok = await usePostActions().moderatePost('p1');

    expect(ok).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith('permission denied');
  });

  it('keeps the user_id filter when deleting an own post', async () => {
    await usePostActions().deletePost('p1');

    expect(deletes()).toEqual([
      expect.objectContaining({ table: 'posts', filters: { id: 'p1', user_id: 'me' } }),
    ]);
  });
});
