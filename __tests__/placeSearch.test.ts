import {
  searchPlaces,
  stripTags,
  kindFromOrigin,
  placeToCoordinate,
  isAbortError,
  type Place,
} from '../lib/placeSearch';

const originalFetch = global.fetch;

function mockFetchJson(body: unknown, status = 200) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

// ─── searchPlaces ─────────────────────────────────────────────────────────────

describe('searchPlaces', () => {
  it('strips tags from labels and keeps coordinates', async () => {
    const fetchMock = mockFetchJson({
      results: [
        {
          id: 1234,
          attrs: {
            label: '<b>Grindelwald</b> (BE)',
            lat: 46.624,
            lon: 8.041,
            origin: 'gg25',
            detail: 'grindelwald be',
          },
        },
        {
          id: 99,
          attrs: {
            label: 'Bahnhofstrasse 1 <b>8001 Zürich</b>',
            lat: 47.37,
            lon: 8.539,
            origin: 'address',
            detail: 'bahnhofstrasse 1 8001 zuerich',
          },
        },
      ],
    });

    const places = await searchPlaces('Grindelwald');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(places).toEqual<Place[]>([
      {
        id: 'gg25-1234',
        name: 'Grindelwald (BE)',
        detail: 'grindelwald be',
        latitude: 46.624,
        longitude: 8.041,
        kind: 'Gemeinde',
      },
      {
        id: 'address-99',
        name: 'Bahnhofstrasse 1 8001 Zürich',
        detail: 'bahnhofstrasse 1 8001 zuerich',
        latitude: 47.37,
        longitude: 8.539,
        kind: 'Adresse',
      },
    ]);
  });

  it('URL-encodes the search text and requests WGS84 locations', async () => {
    const fetchMock = mockFetchJson({ results: [] });
    await searchPlaces('  Zürich & Co ');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('searchText')).toBe('Zürich & Co');
    expect(url.searchParams.get('type')).toBe('locations');
    expect(url.searchParams.get('sr')).toBe('4326');
    expect(url.searchParams.get('limit')).toBe('8');
    expect(url.searchParams.get('lang')).toBe('de');
  });

  it('skips results without coordinates', async () => {
    mockFetchJson({
      results: [
        { id: 1, attrs: { label: 'Ohne Koordinaten', origin: 'gazetteer' } },
        { id: 2, attrs: { label: 'Pilatus', lat: 46.98, lon: 8.25, origin: 'gazetteer' } },
      ],
    });
    const places = await searchPlaces('Pilatus');
    expect(places).toHaveLength(1);
    expect(places[0].name).toBe('Pilatus');
    expect(places[0].kind).toBe('Flurname');
  });

  it('returns an empty list without a request for short input', async () => {
    const fetchMock = mockFetchJson({ results: [] });
    await expect(searchPlaces('')).resolves.toEqual([]);
    await expect(searchPlaces(' a ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws a readable German message on HTTP errors', async () => {
    mockFetchJson({}, 500);
    await expect(searchPlaces('Bern')).rejects.toThrow('Ortssuche fehlgeschlagen (Fehler 500)');
  });

  it('throws a readable German message on network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(searchPlaces('Bern')).rejects.toThrow('Ortssuche nicht erreichbar');
  });

  it('passes the abort signal and rethrows AbortError', async () => {
    const controller = new AbortController();
    const fetchMock = jest.fn((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const promise = searchPlaces('Bern', { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

describe('stripTags', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripTags('<b>Bern</b>  <i>BE</i>')).toBe('Bern BE');
    expect(stripTags('Ober &amp; Unter')).toBe('Ober & Unter');
  });
});

describe('kindFromOrigin', () => {
  it('maps known origins and falls back to Ort', () => {
    expect(kindFromOrigin('zipcode')).toBe('Ort');
    expect(kindFromOrigin('gg25')).toBe('Gemeinde');
    expect(kindFromOrigin('address')).toBe('Adresse');
    expect(kindFromOrigin('gazetteer')).toBe('Flurname');
    expect(kindFromOrigin('unbekannt')).toBe('Ort');
    expect(kindFromOrigin(undefined)).toBe('Ort');
  });
});

describe('placeToCoordinate', () => {
  const place: Place = {
    id: 'gg25-1',
    name: 'Bern',
    detail: 'bern',
    latitude: 46.948,
    longitude: 7.447,
    kind: 'Gemeinde',
  };

  it('returns [longitude, latitude] for start and end points', () => {
    expect(placeToCoordinate(place)).toEqual([7.447, 46.948]);
  });

  it('returns a new array each time so the map flies again', () => {
    expect(placeToCoordinate(place)).not.toBe(placeToCoordinate(place));
  });
});

describe('isAbortError', () => {
  it('detects abort errors only', () => {
    const err = new Error('x');
    err.name = 'AbortError';
    expect(isAbortError(err)).toBe(true);
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
