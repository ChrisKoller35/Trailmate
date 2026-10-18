import {
  formatDuration,
  formatTime,
  getSBBDeepLink,
  suggestDepartureTime,
} from '../lib/publicTransport';

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
