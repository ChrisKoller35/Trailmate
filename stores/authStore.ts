import { create } from 'zustand';
import type { User, Session } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: User | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: User | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingComplete: (value: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  hasCompletedOnboarding: false,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) =>
    set({ profile, hasCompletedOnboarding: !!profile?.display_name }),
  setLoading: (isLoading) => set({ isLoading }),
  setOnboardingComplete: (value) => set({ hasCompletedOnboarding: value }),
  clear: () =>
    set({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      hasCompletedOnboarding: false,
    }),
}));
