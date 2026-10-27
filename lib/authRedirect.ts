// lib/authRedirect.ts
// Reine Entscheidungslogik für die Weiterleitung in app/_layout.tsx,
// damit sie ohne Router und Store testbar ist.

export type AuthRedirectTarget = '/(auth)/login' | '/(onboarding)' | '/(tabs)';

export function getAuthRedirect(state: {
  hasSession: boolean;
  hasCompletedOnboarding: boolean;
  firstSegment: string | undefined;
}): AuthRedirectTarget | null {
  const { hasSession, hasCompletedOnboarding, firstSegment } = state;
  // Live-Tracking-Empfänger brauchen weder Konto noch Onboarding
  if (firstSegment === 'track') return null;

  const inAuthGroup = firstSegment === '(auth)';
  const inOnboardingGroup = firstSegment === '(onboarding)';

  if (!hasSession) return inAuthGroup ? null : '/(auth)/login';
  if (inAuthGroup) return hasCompletedOnboarding ? '/(tabs)' : '/(onboarding)';
  if (!hasCompletedOnboarding && !inOnboardingGroup) return '/(onboarding)';
  if (hasCompletedOnboarding && inOnboardingGroup) return '/(tabs)';
  return null;
}

/** Abgemeldet oder Token-Refresh gescheitert: lokale Session verwerfen. */
export function shouldClearSession(event: string, hasSession: boolean): boolean {
  return event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !hasSession);
}
