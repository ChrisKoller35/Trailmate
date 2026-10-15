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
          email,
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
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    return { data, error };
  }

  async function checkUsername(username: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (error) return true;
      return data === null;
    } catch {
      return true;
    }
  }

  return { signUp, signIn, signOut, resetPassword, checkUsername };
}
