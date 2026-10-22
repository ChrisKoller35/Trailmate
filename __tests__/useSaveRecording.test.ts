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
}

const mockRecorded: RecordedQuery[] = [];
let mockRow: { id: string } | null = null;
let mockError: { code: string; message: string } | null = null;
let mockUserId: string | null = 'me';
const mockReset = jest.fn();

function mockMakeBuilder(table: string) {
  const query: RecordedQuery = { table, op: 'select', values: null, selected: null };
  mockRecorded.push(query);
  const builder = {
    insert: (v: unknown) => { query.op = 'insert'; query.values = v; return builder; },
    select: (cols: string) => { query.selected = cols; return builder; },
    single: () => Promise.resolve({ data: mockError ? null : mockRow, error: mockError }),
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

beforeEach(() => {
  mockRecorded.length = 0;
  mockRow = { id: 'rec-1' };
  mockError = null;
  mockUserId = 'me';
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useSaveRecording', () => {
  it('inserts the recording and returns the new ID', async () => {
    await expect(useSaveRecording().saveRecording(input)).resolves.toBe('rec-1');

    expect(mockRecorded).toHaveLength(1);
    const q = mockRecorded[0];
    expect(q.table).toBe('recordings');
    expect(q.op).toBe('insert');
    expect(q.selected).toBe('id');
    expect(q.values).toMatchObject({
      user_id: 'me',
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
      geom: { type: 'LineString', coordinates: [[8.2, 47, 1200], [8.21, 47.01, 0]] },
    });

    expect(checkAndAwardBadges).toHaveBeenCalledWith('me');
    expect(updateChallengeProgress).toHaveBeenCalledWith('me', input.stats);
    expect(showSuccessToast).toHaveBeenCalledWith('Deine Tour wurde erfolgreich gespeichert.');
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('reports new badges', async () => {
    (checkAndAwardBadges as jest.Mock).mockResolvedValueOnce(['a', 'b']);

    await useSaveRecording().saveRecording(input);

    expect(showSuccessToast).toHaveBeenCalledWith(
      '🏆 Tour gespeichert! Du hast 2 neue Abzeichen verdient!',
    );
  });

  it('still returns the ID when the badge check fails', async () => {
    (checkAndAwardBadges as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    await expect(useSaveRecording().saveRecording(input)).resolves.toBe('rec-1');
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

  it('refuses to save without a signed-in user', async () => {
    mockUserId = null;

    await expect(useSaveRecording().saveRecording(input)).resolves.toBeNull();

    expect(mockRecorded).toHaveLength(0);
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });
});
