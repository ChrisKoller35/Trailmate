import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HikingLevel } from '../types';

interface OnboardingState {
  isOnboardingComplete: boolean;
  currentStep: number;
  displayName: string;
  username: string;
  avatarUri: string | null;
  hikingLevel: HikingLevel | null;
  homeRegion: string | null;
  setDisplayName: (name: string) => void;
  setUsername: (username: string) => void;
  setAvatarUri: (uri: string | null) => void;
  setHikingLevel: (level: HikingLevel | null) => void;
  setHomeRegion: (region: string | null) => void;
  setCurrentStep: (step: number) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      isOnboardingComplete: false,
      currentStep: 1,
      displayName: '',
      username: '',
      avatarUri: null,
      hikingLevel: null,
      homeRegion: null,
      setDisplayName: (displayName) => set({ displayName }),
      setUsername: (username) => set({ username }),
      setAvatarUri: (avatarUri) => set({ avatarUri }),
      setHikingLevel: (hikingLevel) => set({ hikingLevel }),
      setHomeRegion: (homeRegion) => set({ homeRegion }),
      setCurrentStep: (currentStep) => set({ currentStep }),
      completeOnboarding: () => set({ isOnboardingComplete: true }),
      reset: () =>
        set({
          isOnboardingComplete: false,
          currentStep: 1,
          displayName: '',
          username: '',
          avatarUri: null,
          hikingLevel: null,
          homeRegion: null,
        }),
    }),
    {
      name: 'trailmate-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
