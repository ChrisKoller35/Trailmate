// lib/username.ts
// Benutzernamen eingeben, prüfen und vorschlagen. Gleiches Format wie
// is_username_available (Migration 023): ^[a-z0-9_]{3,30}$.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const SUGGESTION_BASE_MAX_LENGTH = 20;
const SUGGESTION_FALLBACK = 'wanderer';

/** Trimmt, entfernt ein führendes @ und schreibt klein. */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase();
}

/** null, wenn der Name gültig ist, sonst ein Fehlertext. */
export function validateUsername(name: string): string | null {
  if (name.length < USERNAME_MIN_LENGTH) return 'Mindestens 3 Zeichen';
  if (name.length > USERNAME_MAX_LENGTH) return 'Höchstens 30 Zeichen';
  if (!/^[a-z0-9_]+$/.test(name)) return 'Nur Kleinbuchstaben, Zahlen und _';
  return null;
}

/** Vorschlag aus dem Anzeigenamen, z. B. «Jürg Müller» → juerg_mueller_4821. */
export function suggestUsername(
  displayName: string,
  random: () => number = Math.random
): string {
  let base = displayName
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Akzente (kombinierende Zeichen)
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_/, '')
    .slice(0, SUGGESTION_BASE_MAX_LENGTH)
    .replace(/_$/, '');
  if (base.length < USERNAME_MIN_LENGTH) base = SUGGESTION_FALLBACK;
  const number = 1000 + Math.floor(random() * 9000);
  return `${base}_${Math.min(number, 9999)}`;
}
