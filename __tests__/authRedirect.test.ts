import { getAuthRedirect, shouldClearSession } from '../lib/authRedirect';

const redirect = (hasSession: boolean, hasCompletedOnboarding: boolean, firstSegment: string | undefined) =>
  getAuthRedirect({ hasSession, hasCompletedOnboarding, firstSegment });

describe('getAuthRedirect', () => {
  describe('ohne Session', () => {
    it.each([['(onboarding)'], ['(tabs)'], ['settings'], [undefined]])('leitet aus %s zum Login', (seg) => {
      expect(redirect(false, false, seg)).toBe('/(auth)/login');
      expect(redirect(false, true, seg)).toBe('/(auth)/login');
    });

    it('bleibt im (auth)-Bereich', () => {
      expect(redirect(false, false, '(auth)')).toBeNull();
    });

    it('lässt den Live-Tracking-Link offen', () => {
      expect(redirect(false, false, 'track')).toBeNull();
    });
  });

  describe('Session ohne Onboarding', () => {
    it('leitet aus (auth) und (tabs) zum Onboarding', () => {
      expect(redirect(true, false, '(auth)')).toBe('/(onboarding)');
      expect(redirect(true, false, '(tabs)')).toBe('/(onboarding)');
    });

    it('bleibt im Onboarding', () => {
      expect(redirect(true, false, '(onboarding)')).toBeNull();
    });

    it('lässt den Live-Tracking-Link offen', () => {
      expect(redirect(true, false, 'track')).toBeNull();
    });
  });

  describe('Session mit Onboarding', () => {
    it('leitet aus (auth) und (onboarding) zu den Tabs', () => {
      expect(redirect(true, true, '(auth)')).toBe('/(tabs)');
      expect(redirect(true, true, '(onboarding)')).toBe('/(tabs)');
    });

    it('bleibt in den Tabs und auf anderen Screens', () => {
      expect(redirect(true, true, '(tabs)')).toBeNull();
      expect(redirect(true, true, 'settings')).toBeNull();
      expect(redirect(true, true, 'track')).toBeNull();
    });
  });
});

describe('shouldClearSession', () => {
  it('verwirft die Session bei SIGNED_OUT', () => {
    expect(shouldClearSession('SIGNED_OUT', false)).toBe(true);
  });

  it('verwirft die Session bei gescheitertem Token-Refresh', () => {
    expect(shouldClearSession('TOKEN_REFRESHED', false)).toBe(true);
  });

  it('behält die Session bei erfolgreichem Token-Refresh', () => {
    expect(shouldClearSession('TOKEN_REFRESHED', true)).toBe(false);
  });

  it('behält die Session bei SIGNED_IN', () => {
    expect(shouldClearSession('SIGNED_IN', true)).toBe(false);
  });
});
