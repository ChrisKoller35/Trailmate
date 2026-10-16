import { formatWarning, formatWarningTime, weatherSourceLabel } from '../lib/weatherLabels';

// Local-time dates so the tests pass in every time zone
const now = new Date(2026, 9, 16, 9, 30); // Fr 16.10.2026 09:30

function at(day: number, hour: number): string {
  return new Date(2026, 9, day, hour, 0).toISOString();
}

describe('weatherSourceLabel', () => {
  it('names MET Norway for yr.no data', () => {
    expect(weatherSourceLabel(['yrno', 'yrno'])).toBe('Quelle: MET Norway (yr.no)');
  });

  it('never shows MeteoSwiss without MeteoSwiss data', () => {
    expect(weatherSourceLabel([])).not.toContain('MeteoSwiss');
    expect(weatherSourceLabel(['yrno'])).not.toContain('MeteoSwiss');
  });

  it('shows MeteoSwiss once such rows exist', () => {
    expect(weatherSourceLabel(['meteoswiss'])).toBe('Quelle: MeteoSwiss');
    expect(weatherSourceLabel(['meteoswiss', 'yrno'])).toBe(
      'Quelle: MeteoSwiss / MET Norway (yr.no)',
    );
  });
});

describe('formatWarningTime', () => {
  it('shows only the time for today', () => {
    expect(formatWarningTime(at(16, 16), now)).toBe('ab 16:00');
  });

  it('says "morgen" for tomorrow', () => {
    expect(formatWarningTime(at(17, 6), now)).toBe('morgen ab 06:00');
  });

  it('shows weekday and date further ahead', () => {
    expect(formatWarningTime(at(18, 14), now)).toBe('So 18.10. ab 14:00');
  });
});

describe('formatWarning', () => {
  it('builds the banner text', () => {
    expect(formatWarning({ message: 'Gewitter', forecast_time: at(16, 16) }, now)).toBe(
      'Gewitter ab 16:00 möglich',
    );
  });
});
