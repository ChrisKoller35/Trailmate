import {
  addDays,
  defaultTravelDate,
  describeTransportError,
  findNearestStation,
  formatDuration,
  formatTime,
  formatTravelDateLabel,
  getSBBDeepLink,
  suggestDepartureTime,
  TransportApiError,
} from '../lib/publicTransport';

// ─── Travel dates ─────────────────────────────────────────────────────────────

describe('travel dates', () => {
  const now = new Date(2026, 9, 25, 7, 0);

  it('defaults to tomorrow, labelled «Morgen»', () => {
    expect(defaultTravelDate(now)).toBe('2026-10-26');
    expect(formatTravelDateLabel('2026-10-26', now)).toBe('Morgen');
  });

  it('labels today and other days', () => {
    expect(formatTravelDateLabel('2026-10-25', now)).toBe('Heute');
    expect(formatTravelDateLabel('2026-10-27', now)).toBe('Di 27.10.');
  });

  it('adds days across year end, DST change and month start', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

// ─── Errors ───────────────────────────────────────────────────────────────────

describe('describeTransportError', () => {
  it('reports a missing connection for network errors', () => {
    expect(describeTransportError(new TypeError('Network request failed'))).toContain(
      'Keine Internetverbindung',
    );
    expect(describeTransportError(new TransportApiError('x', 500), false)).toContain(
      'Keine Internetverbindung',
    );
    expect(describeTransportError(new Error('x'), false)).toContain('Keine Internetverbindung');
  });

  it('distinguishes rate limits from other API errors', () => {
    expect(describeTransportError(new TransportApiError('x', 429))).toContain('überlastet');
    expect(describeTransportError(new TransportApiError('x', 503))).toContain('antwortet gerade nicht');
    expect(describeTransportError(new Error('x'))).toBe('ÖV-Verbindungen konnten nicht geladen werden.');
  });

  describe('with a failing API', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('throws a TransportApiError and describes it in German', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
      const err = await findNearestStation(46.9, 7.4).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(TransportApiError);
      expect((err as TransportApiError).status).toBe(500);
      const message = describeTransportError(err);
      expect(message).toContain('Fahrplandienst');
      expect(message.toLowerCase()).not.toContain('failed');
    });
  });
});

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats the API format with hours and minutes', () => {
    expect(formatDuration('00d01:30:00')).toBe('1h 30min');
  });

  it('omits minutes when they are zero', () => {
    expect(formatDuration('00d02:00:00')).toBe('2h');
  });

  it('shows only minutes for connections under an hour', () => {
    expect(formatDuration('00d00:45:00')).toBe('45min');
  });

  it('adds days to the hours', () => {
    expect(formatDuration('01d02:15:00')).toBe('26h 15min');
  });

  it('returns 0min for a zero duration', () => {
    expect(formatDuration('00d00:00:00')).toBe('0min');
  });

  it('falls back to the HH:MM:SS format', () => {
    expect(formatDuration('01:05:00')).toBe('1h 5min');
    expect(formatDuration('00:20:00')).toBe('20min');
  });

  it('returns unknown formats unchanged', () => {
    expect(formatDuration('')).toBe('');
    expect(formatDuration('90 min')).toBe('90 min');
  });
});

// ─── formatTime ───────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats local time as HH:MM with leading zeros', () => {
    const iso = new Date(2026, 5, 1, 7, 5).toISOString();
    expect(formatTime(iso)).toBe('07:05');
  });

  it('formats midnight as 00:00', () => {
    const iso = new Date(2026, 5, 1, 0, 0).toISOString();
    expect(formatTime(iso)).toBe('00:00');
  });
});

// ─── getSBBDeepLink ───────────────────────────────────────────────────────────

describe('getSBBDeepLink', () => {
  it('builds an SBB timetable URL with all parameters', () => {
    const url = new URL(getSBBDeepLink('Bern', 'Grindelwald', '2026-06-01', '08:00'));
    expect(url.origin).toBe('https://www.sbb.ch');
    expect(url.searchParams.get('from')).toBe('Bern');
    expect(url.searchParams.get('to')).toBe('Grindelwald');
    expect(url.searchParams.get('date')).toBe('2026-06-01');
    expect(url.searchParams.get('time')).toBe('08:00');
  });

  it('encodes spaces, umlauts and special characters', () => {
    const url = new URL(getSBBDeepLink('Zürich HB', 'Brig & Visp', '2026-06-01', '08:00'));
    expect(url.searchParams.get('from')).toBe('Zürich HB');
    expect(url.searchParams.get('to')).toBe('Brig & Visp');
    expect(url.search).not.toContain(' ');
  });
});

// ─── suggestDepartureTime ─────────────────────────────────────────────────────

describe('suggestDepartureTime', () => {
  it('suggests arriving at 09:00 for short routes', () => {
    expect(suggestDepartureTime(120)).toEqual({ departureTime: '08:00', arrivalTime: '09:00' });
  });

  it('suggests arriving at 08:00 for medium routes (> 3 h)', () => {
    expect(suggestDepartureTime(181)).toEqual({ departureTime: '07:00', arrivalTime: '08:00' });
  });

  it('suggests arriving at 07:00 for long routes (> 5 h)', () => {
    expect(suggestDepartureTime(301)).toEqual({ departureTime: '06:00', arrivalTime: '07:00' });
  });

  it('treats the exact boundaries as the shorter category', () => {
    expect(suggestDepartureTime(180).arrivalTime).toBe('09:00');
    expect(suggestDepartureTime(300).arrivalTime).toBe('08:00');
  });

  it('handles a zero duration', () => {
    expect(suggestDepartureTime(0).arrivalTime).toBe('09:00');
  });
});
