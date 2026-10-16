import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { useRegisterPushToken } from '../hooks/useNotifications';
import type { User } from '../types';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in development; replace with a crash-reporting service
    // (e.g. Sentry) in production.
    console.error('[ErrorBoundary] Unhandled error:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#c00', marginBottom: 8 }}>App-Fehler</Text>
          <Text style={{ fontSize: 14, color: '#333', textAlign: 'center', marginBottom: 24 }}>
            {this.state.error?.message}
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: '#2D5A27', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>App neu starten</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

function useAuthListener() {
  const { setSession, setUser, setProfile, setLoading } = useAuthStore();
  const registerPushToken = useRegisterPushToken();

  useEffect(() => {
    // Safety timeout: if auth check takes >3s, unblock the app
    const timeout = setTimeout(() => setLoading(false), 3000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session as any);
      setUser(session?.user as any ?? null);
      if (session?.user?.id) {
        try {
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          setProfile((data as User) ?? null);
          // Register push token after profile is loaded
          registerPushToken().catch(() => {});
        } catch {
          // Supabase not reachable — continue without profile
        }
      }
      setLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      // Supabase not configured or unreachable — let the app load anyway
      setLoading(false);
    });

    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const result = supabase.auth.onAuthStateChange(
        async (event, session) => {
          // Auto-logout on token refresh failure
          if (event === 'TOKEN_REFRESHED' && !session) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          setSession(session as any);
          setUser(session?.user as any ?? null);
          if (session?.user?.id) {
            try {
              const { data } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
              setProfile((data as User) ?? null);
            } catch {
              // Supabase not reachable
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
        }
      );
      subscription = result.data.subscription;
    } catch {
      // Supabase not configured
    }

    return () => {
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);
}

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const { session, isLoading, hasCompletedOnboarding } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      if (hasCompletedOnboarding) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(onboarding)');
      }
    } else if (session && !hasCompletedOnboarding && !inOnboardingGroup && !inAuthGroup) {
      router.replace('/(onboarding)');
    } else if (session && hasCompletedOnboarding && inOnboardingGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments, isLoading, hasCompletedOnboarding]);
}

export default function RootLayout() {
  useAuthListener();
  useProtectedRoute();

  const { isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F7F0' }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>⛰️</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#2D5A27', marginBottom: 12 }}>TrailMate</Text>
        <ActivityIndicator size="large" color="#2D5A27" />
        <Text style={{ fontSize: 13, color: '#666', marginTop: 12 }}>Wird geladen…</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal', headerShown: true, title: 'Profil bearbeiten' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card', headerShown: true, title: 'Einstellungen' }} />
        <Stack.Screen name="notification-settings" options={{ presentation: 'card', headerShown: true, title: 'Benachrichtigungen' }} />
        <Stack.Screen name="followers" options={{ presentation: 'card', headerShown: true, title: 'Follower' }} />
        <Stack.Screen name="following" options={{ presentation: 'card', headerShown: true, title: 'Folge ich' }} />
        <Stack.Screen name="create-post" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="saved-posts" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="follow-requests" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="messages" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="chat" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="post-messages" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="groups" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="group-detail" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="create-group" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="communities" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="community-detail" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="events" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="create-event" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="blocked-users" options={{ presentation: 'card', headerShown: false }} />
        <Stack.Screen name="badges" options={{ presentation: 'card', headerShown: true, title: 'Meine Abzeichen' }} />
        <Stack.Screen name="challenges" options={{ presentation: 'card', headerShown: true, title: 'Challenges' }} />
        <Stack.Screen name="challenge-detail" options={{ presentation: 'card', headerShown: true, title: 'Challenge' }} />
        <Stack.Screen name="stats" options={{ presentation: 'card', headerShown: true, title: 'Statistiken' }} />
        <Stack.Screen name="year-review" options={{ presentation: 'modal', headerShown: true, title: 'Jahresrückblick' }} />
        <Stack.Screen name="live-tracking" options={{ presentation: 'card', headerShown: true, title: 'Live-Tracking' }} />
        <Stack.Screen name="premium" options={{ presentation: 'modal', headerShown: true, title: 'Premium' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'card', headerShown: true, title: 'Benachrichtigungen' }} />
      </Stack>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
