import { getSupabaseConfigError } from '../lib/supabaseConfig';

const URL = 'https://abc.supabase.co';
const KEY = 'geheimer-anon-key-123';

describe('getSupabaseConfigError', () => {
  it('meldet fehlende URL', () => {
    expect(getSupabaseConfigError(undefined, KEY)).toBe('EXPO_PUBLIC_SUPABASE_URL fehlt.');
    expect(getSupabaseConfigError('', KEY)).toBe('EXPO_PUBLIC_SUPABASE_URL fehlt.');
  });

  it('meldet fehlenden Schlüssel', () => {
    expect(getSupabaseConfigError(URL, undefined)).toBe('EXPO_PUBLIC_SUPABASE_ANON_KEY fehlt.');
  });

  it('meldet beides zusammen', () => {
    const msg = getSupabaseConfigError(undefined, undefined);
    expect(msg).toContain('EXPO_PUBLIC_SUPABASE_URL fehlt.');
    expect(msg).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY fehlt.');
  });

  it('meldet URL ohne https://', () => {
    expect(getSupabaseConfigError('abc.supabase.co', KEY)).toBe(
      'EXPO_PUBLIC_SUPABASE_URL muss mit https:// beginnen.',
    );
  });

  it('akzeptiert https:// und http://', () => {
    expect(getSupabaseConfigError(URL, KEY)).toBeNull();
    expect(getSupabaseConfigError('http://127.0.0.1:54321', KEY)).toBeNull();
  });

  it('schreibt nie den Wert des Schlüssels oder der URL in die Meldung', () => {
    const msg = getSupabaseConfigError('ftp://geheim.example', KEY) ?? '';
    expect(msg).not.toContain(KEY);
    expect(msg).not.toContain('geheim.example');
  });
});
