// __tests__/useSaveRecording.test.ts
// Unit tests for hooks/useSaveRecording.
//
// React Query is mocked so the hook can be called directly without
// renderHook (style of useFollow.test.ts); the Supabase client records the
// insert and returns the configured row or error.

import { useSaveRecording, type SaveRecordingInput } from '../hooks/useSaveRecording';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { checkAndAwardBadges, updateChallengeProgress } from '../lib/badgeEngine';

// ─── Mocks ────────────────────────────────────────────────────────────────────

interface RecordedQuery {
  table: string;
  op: 'insert' | 'select';
  values: unknown;
  selected: string | null;
  inIds?: string[];
}

const mockRecorded: RecordedQuery[] = [];
let mockRow: { id: string } | null = null;
let mockError: { code: string; message: string } | null = null;
// Fehler für die nächsten Inserts der Reihe nach; leer = mockError
const mockErrorQueue: ({ code: string; message: string } | null)[] = [];
let mockBadges: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};
let mockUserId: string | null = 'me';
const mockReset = jest.fn();

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: 'select', values: null, selected: null };
  mockRecorded.push(query);
  const builder = {
    insert: (v: unknown) => { query.op = 'insert'; query.values = v; return builder; },
    select: (cols: string) => { query.selected = cols; return builder; },
    in: (_col: string, ids: string[]) => { query.inIds = ids; return Promise.resolve(mockBadges); },
    single: () => {
      const error = mockErrorQueue.length > 0 ? mockErrorQueue.shift() ?? null : mockError;
      return Promise.resolve({ data: error ? null : mockRow, error });
    },
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

jest.mock('../stores/recordingStore', () => ({
  useRecordingStore: (sel: (s: { reset: () => void }) => unknown) => sel({ reset: mockReset }),
}));

jest.mock('../lib/toast', () => ({ showErrorToast: jest.fn(), showSuccessToast: jest.fn() }));

jest.mock('../lib/badgeEngine', () => ({
  checkAndAwardBadges: jest.fn(async () => []),
  updateChallengeProgress: jest.fn(async () => undefined),
}));

interface MutationOptions {
  mutationFn: (v: SaveRecordingInput) => Promise<unknown>;
  onError?: (e: unknown) => void;
}

jest.mock('@tanstack/react-query', () => ({
  useMutation: (opts: MutationOptions) => ({
    isPending: false,
    mutateAsync: async (v: SaveRecordingInput) => {
      try {
        return await opts.mutationFn(v);
      } catch (e) {
        opts.onError?.(e);
        throw e;
      }
    },
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

const input: SaveRecordingInput = {
  title: '  Pilatus Rundweg ',
  stats: {
    distance: 12_437.4,
    elevationGain: 849.6,
    elevationLoss: 801.2,
    duration: 18_000,
    avgSpeed: 2.4871,
    steps: 0,
  },
  movingSeconds: 15_150.4,
  startedAt: Date.UTC(2026, 9, 12, 8, 0, 0),
  trackPoints: [
    { latitude: 47, longitude: 8.2, altitude: 1200, timestamp: 1, speed: null, accuracy: null },
    { latitude: 47.01, longitude: 8.21, altitude: null, timestamp: 2, speed: null, accuracy: null },
  ],
};

const ROUTE_ID = '3f2b8c1e-5d4a-4e7b-9c0d-1a2b3c4d5e6f';

beforeEach(() => {
  mockRecorded.length = 0;
  mockRow = { id: 'rec-1' };
  mockError = null;
  mockErrorQueue.length = 0;
  mockBadges = { data: [], error: null };
  mockUserId = 'me';
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useSaveRecording', () => {
  it('inserts the recording and returns the new ID', async () => {
    await expect(useSaveRecording().saveRecording(input)).resolves.toEqual({
      recordingId: 'rec-1',
      newBadges: [],
    });

    // Ohne neue Abzeichen keine Abfrage auf badges
    expect(mockRecorded).toHaveLength(1);
    const q = mockRecorded[0];
    expect(q.table).toBe('recordings');
    expect(q.op).toBe('insert');
    expect(q.selected).toBe('id');
    expect(q.values).toMatchObject({
      user_id: 'me',
      route_id: null,
      title: 'Pilatus Rundweg',
      distance_m: 12_437,
      elevation_gain_m: 850,
      elevation_loss_m: 801,
      duration_seconds: 18_000,
      moving_time_seconds: 15_150,
      avg_speed_kmh: 2.5,
      steps: null,
      started_at: '2026-10-12T08:00:00.000Z',
      is_hidden: false,
      // 2D, sonst lehnt die Spalte geometry(LineString, 4326) die Zeile ab
      geom: { type: 'LineString', coordinates: [[8.2, 47], [8.21, 47.01]] },
    });

    expect(checkAndAwardBadges).toHaveBeenCalledWith('me');
    expect(updateChallengeProgress).toHaveBeenCalledWith('me', input.stats);
    expect(showSuccessToast).toHaveBeenCalledWith('Deine Tour wurde erfolgreich gespeichert.');
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('loads the new badges and returns them in the order of the IDs', async () => {
    (checkAndAwardBadges as jest.Mock).mockResolvedValueOnce(['a', 'b']);
    const badgeA = { id: 'a', name: 'Erster Gipfel', description: null, icon_url: '🏔️', category: null, rarity: 'normal' };
    const badgeB = { id: 'b', name: 'Frühaufsteher', description: null, icon_url: '🌅', category: null, rarity: 'rare' };
    mockBadges = { data: [badgeB, badgeA], error: null };

    await expect(useSaveRecording().saveRecording(input)).resolves.toEqual({
      recordingId: 'rec-1',
      newBadges: [badgeA, badgeB],
    });

    expect(mockRecorded).toHaveLength(2);
    expect(mockRecorded[1]).toMatchObject({
      table: 'badges',
      selected: 'id, name, description, icon_url, category, rarity',
      inIds: ['a', 'b'],
    });
    expect(showSuccessToast).toHaveBeenCalledWith('Deine Tour wurde erfolgreich gespeichert.');
  });

  it('reports the number of new badges when loading their details fails', async () => {
    (checkAndAwardBadges as jest.Mock).mockResolvedValueOnce(['a', 'b']);
    mockBadges = { data: null, error: { message: 'network' } };

    await expect(useSaveRecording().saveRecording(input)).resolves.toEqual({
      recordingId: 'rec-1',
      newBadges: [],
    });

    expect(showSuccessToast).toHaveBeenCalledWith(
      '🏆 Tour gespeichert! Du hast 2 neue Abzeichen verdient!',
    );
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('still returns the ID when the badge check fails', async () => {
    (checkAndAwardBadges as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    await expect(useSaveRecording().saveRecording(input)).resolves.toMatchObject({
      recordingId: 'rec-1',
    });
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast and keeps the recording when the insert fails', async () => {
    mockError = { code: '42501', message: 'row-level security' };

    await expect(useSaveRecording().saveRecording(input)).resolves.toBeNull();

    expect(showErrorToast).toHaveBeenCalledWith(
      'Die Tour konnte nicht gespeichert werden. Bitte versuche es erneut.',
    );
    expect(mockReset).not.toHaveBeenCalled();
    expect(checkAndAwardBadges).not.toHaveBeenCalled();
  });

  it('sends route_id when the recording belongs to a route', async () => {
    await useSaveRecording().saveRecording({ ...input, routeId: ROUTE_ID });

    expect(mockRecorded).toHaveLength(1);
    expect(mockRecorded[0].values).toMatchObject({ route_id: ROUTE_ID });
  });

  it('retries once without route_id when the route was deleted (23503)', async () => {
    mockErrorQueue.push({ code: '23503', message: 'foreign key violation' });

    await expect(
      useSaveRecording().saveRecording({ ...input, routeId: ROUTE_ID }),
    ).resolves.toMatchObject({ recordingId: 'rec-1' });

    expect(mockRecorded).toHaveLength(2);
    expect(mockRecorded[0].values).toMatchObject({ route_id: ROUTE_ID });
    expect(mockRecorded[1].op).toBe('insert');
    expect(mockRecorded[1].values).toMatchObject({ route_id: null, title: 'Pilatus Rundweg' });
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('does not retry on 23503 without a route', async () => {
    mockError = { code: '23503', message: 'foreign key violation' };

    await expect(useSaveRecording().saveRecording(input)).resolves.toBeNull();

    expect(mockRecorded).toHaveLength(1);
    expect(mockRecorded[0].values).toMatchObject({ route_id: null });
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('retries only once when the second insert fails as well', async () => {
    mockError = { code: '23503', message: 'foreign key violation' };

    await expect(
      useSaveRecording().saveRecording({ ...input, routeId: ROUTE_ID }),
    ).resolves.toBeNull();

    expect(mockRecorded).toHaveLength(2);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('refuses to save without a signed-in user', async () => {
    mockUserId = null;

    await expect(useSaveRecording().saveRecording(input)).resolves.toBeNull();

    expect(mockRecorded).toHaveLength(0);
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });
});
