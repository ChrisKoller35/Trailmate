// __tests__/useRouteGeometry.test.ts
// Unit tests for hooks/useRouteGeometry.
//
// React Query is mocked (style of useSaveRecording.test.ts): useQuery hands
// its options to the test, which runs queryFn directly.

import { useRouteGeometry } from '../hooks/useRouteGeometry';

const mockRpc = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

interface QueryOptions {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  enabled: boolean;
}

let mockOptions: QueryOptions | null = null;
let mockData: unknown;

jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: QueryOptions) => {
    mockOptions = opts;
    return { data: mockData };
  },
}));

const ROUTE_ID = '11111111-2222-3333-4444-555555555555';

beforeEach(() => {
  mockRpc.mockReset();
  mockOptions = null;
  mockData = undefined;
});

describe('useRouteGeometry', () => {
  it('liefert die LineString als Feature', async () => {
    const coordinates = [[7.5, 46.9, 540], [7.6, 46.8, 800]];
    mockRpc.mockResolvedValue({ data: { type: 'LineString', coordinates }, error: null });
    useRouteGeometry(ROUTE_ID);
    expect(mockOptions?.queryKey).toEqual(['routeGeometry', ROUTE_ID]);
    expect(mockOptions?.enabled).toBe(true);

    const feature = await mockOptions?.queryFn();
    expect(mockRpc).toHaveBeenCalledWith('get_route_geojson', { route_id: ROUTE_ID });
    expect(feature).toEqual({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    });
  });

  it('ergibt null bei einem RPC-Fehler', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    useRouteGeometry(ROUTE_ID);
    await expect(mockOptions?.queryFn()).resolves.toBeNull();

    mockRpc.mockRejectedValue(new Error('offline'));
    await expect(mockOptions?.queryFn()).resolves.toBeNull();
  });

  it('fragt ohne Route nichts ab', () => {
    mockData = { type: 'Feature' };
    expect(useRouteGeometry(null)).toBeNull();
    expect(mockOptions?.enabled).toBe(false);
  });
});
