// Display texts for the weather card: source attribution and warning times.

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Attribution from the `source` of the forecast rows themselves.
 * yr.no requires "MET Norway" to be named; MeteoSwiss only appears once
 * rows with `source === 'meteoswiss'` actually exist.
 */
export function weatherSourceLabel(forecastSources: string[]): string {
  const sources = new Set(forecastSources);
  const hasMeteoSwiss = sources.has('meteoswiss');
  const hasOther = [...sources].some((s) => s !== 'meteoswiss');

  if (hasMeteoSwiss && hasOther) return 'Quelle: MeteoSwiss / MET Norway (yr.no)';
  if (hasMeteoSwiss) return 'Quelle: MeteoSwiss';
  return 'Quelle: MET Norway (yr.no)';
}

/**
 * When a warning starts, relative to `now`: "ab 16:00", "morgen ab 06:00"
 * or "So 18.10. ab 14:00". Uses the device time zone like the rest of the card.
 */
export function formatWarningTime(forecastTime: string, now: Date = new Date()): string {
  const date = new Date(forecastTime);
  const clock = `ab ${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (date.toDateString() === now.toDateString()) return clock;
  if (date.toDateString() === tomorrow.toDateString()) return `morgen ${clock}`;
  return `${WEEKDAYS[date.getDay()]} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${clock}`;
}

/** Banner text for one warning, e.g. "Gewitter ab 16:00 möglich". */
export function formatWarning(
  warning: { message: string; forecast_time: string },
  now: Date = new Date(),
): string {
  return `${warning.message} ${formatWarningTime(warning.forecast_time, now)} möglich`;
}
