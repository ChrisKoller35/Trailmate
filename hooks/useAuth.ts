import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useOnboardingStore } from '../stores/onboardingStore';

export function useAuth() {
  const { clear } = useAuthStore();

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    // Pre-create user row so foreign key constraints never fail
    if (!error && data.user?.id) {
      const tempUsername = `user_${Date.now().toString(36)}`;
      try {
        await supabase.from('users').upsert({
          id: data.user.id,
          username: tempUsername,
        }, { onConflict: 'id' });
      } catch {
        // Ignore – onboarding will retry
      }
    }
    return { data, error };
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    clear();
    useOnboardingStore.getState().reset();
  }

  async function resetPassword(email: string) {
    // App: trailmate://reset-password, Web: <Adresse der Web-App>/reset-password.
    // Beide müssen im Supabase-Dashboard als Redirect-URL eingetragen sein.
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('reset-password'),
    });
    return { data, error };
  }

  // RPC aus Migration 023: sieht auch private Konten, ohne Gross-/Kleinschreibung.
  // Fehlt die Funktion (Migration online noch nicht da) oder scheitert der
  // Aufruf, gilt der Name als frei; den 23505 beim Speichern fängt
  // home-region.tsx ab.
  async function checkUsername(username: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_username_available', {
        p_username: username,
      });
      if (error) return true;
      return data === true;
    } catch {
      return true;
    }
  }

  return { signUp, signIn, signOut, resetPassword, checkUsername };
}
