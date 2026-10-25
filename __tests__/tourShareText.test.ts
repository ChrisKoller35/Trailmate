// __tests__/tourShareText.test.ts
// Unit tests for buildTourShareText (lib/tourShareText).

import {
  buildBadgeShareText,
  buildTourShareText,
  formatSwissNumber,
  TOUR_SHARE_TEXT_MAX_LENGTH,
} from '../lib/tourShareText';

describe('buildTourShareText', () => {
  it('builds title and stats line', () => {
    expect(
      buildTourShareText({
        title: 'Pilatus Rundweg',
        distanceM: 12_437,
        elevationGainM: 849.6,
        durationSeconds: 5 * 3600,
        movingSeconds: 4 * 3600 + 12 * 60 + 30,
      }),
    ).toBe('Pilatus Rundweg\n12,4 km · ↑ 850 m · 4 h 12 min unterwegs');
  });

  it('rounds distance and uses Swiss thousands separator', () => {
    expect(
      buildTourShareText({ title: 'Hoch', distanceM: 999.6, elevationGainM: 1249.5 }),
    ).toBe('Hoch\n1000 m · ↑ 1’250 m');
  });

  it('falls back to the total duration when moving time is missing', () => {
    expect(
      buildTourShareText({ title: 'Kurz', durationSeconds: 45 * 60, movingSeconds: 0 }),
    ).toBe('Kurz\n45 min unterwegs');
  });

  it('omits missing and zero values', () => {
    expect(
      buildTourShareText({
        title: 'Spaziergang',
        distanceM: 0,
        elevationGainM: null,
        durationSeconds: undefined,
        movingSeconds: 20,
      }),
    ).toBe('Spaziergang');
    expect(buildTourShareText({ title: 'X', elevationGainM: 120 })).toBe('X\n↑ 120 m');
  });

  it('uses «Meine Tour» for an empty title', () => {
    expect(buildTourShareText({ title: '   ', distanceM: 2500 })).toBe('Meine Tour\n2,5 km');
    expect(buildTourShareText({})).toBe('Meine Tour');
  });

  it('never exceeds 280 characters and keeps the stats line', () => {
    const text = buildTourShareText({
      title: 'A'.repeat(500),
      distanceM: 12_400,
      elevationGainM: 850,
      movingSeconds: 3600,
    });
    expect(text.length).toBeLessThanOrEqual(TOUR_SHARE_TEXT_MAX_LENGTH);
    expect(text.endsWith('\n12,4 km · ↑ 850 m · 1 h 0 min unterwegs')).toBe(true);
    expect(text).toContain('…');
  });

  it('cuts a long title without stats to 280 characters', () => {
    const text = buildTourShareText({ title: 'B'.repeat(400) });
    expect(text.length).toBe(TOUR_SHARE_TEXT_MAX_LENGTH);
  });
});

describe('formatSwissNumber', () => {
  it('groups thousands with an apostrophe', () => {
    expect(formatSwissNumber(1234567.4)).toBe('1’234’567');
    expect(formatSwissNumber(999)).toBe('999');
  });
});

describe('buildBadgeShareText', () => {
  it('builds the text with icon and name', () => {
    expect(buildBadgeShareText({ name: 'Erster Gipfel', icon_url: '🏔️' })).toBe(
      'Neues Abzeichen: 🏔️ Erster Gipfel 🏆',
    );
  });

  it('falls back to 🏅 without an icon', () => {
    expect(buildBadgeShareText({ name: 'Erster Gipfel', icon_url: null })).toBe(
      'Neues Abzeichen: 🏅 Erster Gipfel 🏆',
    );
  });

  it('falls back to «Abzeichen» without a name', () => {
    expect(buildBadgeShareText({ name: null, icon_url: '🏔️' })).toBe(
      'Neues Abzeichen: 🏔️ Abzeichen 🏆',
    );
  });
});
