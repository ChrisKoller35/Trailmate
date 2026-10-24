// __tests__/username.test.ts
// Unit tests for lib/username.

import { normalizeUsername, suggestUsername, validateUsername } from '../lib/username';

describe('normalizeUsername', () => {
  it('trims, removes one leading @ and lowercases', () => {
    expect(normalizeUsername('  @Anna_B ')).toBe('anna_b');
    expect(normalizeUsername('@@x')).toBe('@x');
  });
});

describe('validateUsername', () => {
  it('accepts valid names', () => {
    expect(validateUsername('abc')).toBeNull();
    expect(validateUsername('a'.repeat(30))).toBeNull();
    expect(validateUsername('juerg_99')).toBeNull();
  });

  it('rejects wrong length and characters', () => {
    expect(validateUsername('ab')).toBe('Mindestens 3 Zeichen');
    expect(validateUsername('a'.repeat(31))).toBe('Höchstens 30 Zeichen');
    expect(validateUsername('anna b')).toBe('Nur Kleinbuchstaben, Zahlen und _');
    expect(validateUsername('Anna')).toBe('Nur Kleinbuchstaben, Zahlen und _');
    expect(validateUsername('jürg')).toBe('Nur Kleinbuchstaben, Zahlen und _');
  });
});

describe('suggestUsername', () => {
  it('transliterates and appends a four-digit number', () => {
    expect(suggestUsername('Jürg Müller')).toMatch(/^juerg_mueller_\d{4}$/);
    expect(suggestUsername('Zoë')).toMatch(/^zoe_\d{4}$/);
    expect(suggestUsername('!!')).toMatch(/^wanderer_\d{4}$/);
    expect(suggestUsername('Hans-Peter  Weiß')).toMatch(/^hans_peter_weiss_\d{4}$/);
  });

  it('uses the random function for the number', () => {
    expect(suggestUsername('Anna', () => 0)).toBe('anna_1000');
    expect(suggestUsername('Anna', () => 0.999999)).toBe('anna_9999');
  });

  it('always produces a valid name', () => {
    const names = ['', '  ', 'Ä', 'a b c d e f g h i j k l m n o p', '___x___', 'Ångström Ørsted', '😀 Émile'];
    for (const name of names) {
      const suggestion = suggestUsername(name);
      expect(validateUsername(suggestion)).toBeNull();
      expect(suggestion).not.toMatch(/__/);
    }
  });
});
