import { parseRecoveryUrl, passwordProblem, passwordUpdateErrorMessage } from '../lib/authRecovery';

describe('parseRecoveryUrl', () => {
  it('liest die Schlüssel nach #', () => {
    expect(parseRecoveryUrl('trailmate://reset-password#access_token=a&refresh_token=r&type=recovery')).toEqual({
      kind: 'tokens',
      accessToken: 'a',
      refreshToken: 'r',
    });
  });

  it('liest die Schlüssel aus der Query', () => {
    expect(parseRecoveryUrl('https://app.example.ch/reset-password?access_token=a&refresh_token=r')).toEqual({
      kind: 'tokens',
      accessToken: 'a',
      refreshToken: 'r',
    });
  });

  it('meldet einen abgelaufenen Link auf Deutsch', () => {
    expect(
      parseRecoveryUrl(
        'trailmate://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({ kind: 'error', message: 'Der Link ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.' });
  });

  it('meldet andere Fehler als ungültigen Link', () => {
    expect(parseRecoveryUrl('trailmate://reset-password#error=server_error')).toEqual({
      kind: 'error',
      message: 'Der Link ist ungültig. Fordere einen neuen an.',
    });
  });

  it('lehnt einen fremden type ab', () => {
    expect(parseRecoveryUrl('trailmate://reset-password#access_token=a&refresh_token=r&type=signup')).toEqual({
      kind: 'error',
      message: 'Der Link ist ungültig. Fordere einen neuen an.',
    });
  });

  it('ergibt none ohne Schlüssel oder ohne Adresse', () => {
    expect(parseRecoveryUrl('trailmate://reset-password')).toEqual({ kind: 'none' });
    expect(parseRecoveryUrl(null)).toEqual({ kind: 'none' });
    expect(parseRecoveryUrl(undefined)).toEqual({ kind: 'none' });
  });
});

describe('passwordProblem', () => {
  it('verlangt mindestens 8 Zeichen', () => {
    expect(passwordProblem('kurz', 'kurz')).toBe('Mindestens 8 Zeichen erforderlich.');
  });

  it('verlangt zwei gleiche Eingaben', () => {
    expect(passwordProblem('langesPasswort', 'anderesPasswort')).toBe('Die Passwörter stimmen nicht überein.');
  });

  it('akzeptiert ein gutes Passwort', () => {
    expect(passwordProblem('langesPasswort', 'langesPasswort')).toBeNull();
  });
});

describe('passwordUpdateErrorMessage', () => {
  it('übersetzt die bekannten Codes', () => {
    expect(passwordUpdateErrorMessage({ code: 'same_password' })).toBe(
      'Das neue Passwort muss sich vom alten unterscheiden.',
    );
    expect(passwordUpdateErrorMessage({ code: 'weak_password' })).toBe(
      'Das Passwort ist zu schwach. Nimm ein längeres.',
    );
  });

  it('zeigt sonst eine allgemeine Meldung', () => {
    expect(passwordUpdateErrorMessage({ message: 'Network request failed' })).toBe(
      'Das Passwort konnte nicht geändert werden. Versuche es nochmals.',
    );
  });
});
