// lib/authRecovery.ts
// Reine Logik für den Passwort-Reset in app/reset-password.tsx, damit sie
// ohne Router und Supabase testbar ist.

export type RecoveryLink =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

const EXPIRED_MESSAGE = 'Der Link ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.';
const INVALID_MESSAGE = 'Der Link ist ungültig. Fordere einen neuen an.';

const KEYS = ['access_token', 'refresh_token', 'type', 'error', 'error_code'];

function paramsFrom(part: string): URLSearchParams | null {
  const params = new URLSearchParams(part);
  return KEYS.some((key) => params.has(key)) ? params : null;
}

/**
 * Supabase hängt die Werte im impliziten Ablauf nach `#` an die
 * Rücksprung-Adresse; die Query dient als Rückfall. Den englischen Text aus
 * `error_description` zeigen wir nie an.
 */
export function parseRecoveryUrl(url: string | null | undefined): RecoveryLink {
  if (!url) return { kind: 'none' };
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = beforeHash.indexOf('?');
  const params =
    (hashIndex >= 0 ? paramsFrom(url.slice(hashIndex + 1)) : null) ??
    (queryIndex >= 0 ? paramsFrom(beforeHash.slice(queryIndex + 1)) : null);
  if (!params) return { kind: 'none' };

  if (params.has('error') || params.has('error_code')) {
    const expired = params.get('error_code') === 'otp_expired';
    return { kind: 'error', message: expired ? EXPIRED_MESSAGE : INVALID_MESSAGE };
  }

  const type = params.get('type');
  if (type && type !== 'recovery') return { kind: 'error', message: INVALID_MESSAGE };

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };
  return { kind: 'none' };
}

/** Dieselben Regeln wie app/(auth)/register.tsx. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < 8) return 'Mindestens 8 Zeichen erforderlich.';
  if (password !== confirm) return 'Die Passwörter stimmen nicht überein.';
  return null;
}

export function passwordUpdateErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === 'same_password') return 'Das neue Passwort muss sich vom alten unterscheiden.';
  if (error.code === 'weak_password') return 'Das Passwort ist zu schwach. Nimm ein längeres.';
  return 'Das Passwort konnte nicht geändert werden. Versuche es nochmals.';
}
