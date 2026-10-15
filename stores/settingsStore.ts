import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'system';
type MapStyle = 'outdoors' | 'satellite' | 'terrain';
type Units = 'metric' | 'imperial';

interface NotificationSettings {
  pushEnabled: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  groups: boolean;
  challenges: boolean;
}

interface SettingsState {
  theme: Theme;
  mapStyle: MapStyle;
  units: Units;
  notifications: NotificationSettings;
  setTheme: (theme: Theme) => void;
  setMapStyle: (mapStyle: MapStyle) => void;
  setUnits: (units: Units) => void;
  setNotifications: (notifications: Partial<NotificationSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      mapStyle: 'outdoors',
      units: 'metric',
      notifications: {
        pushEnabled: true,
        likes: true,
        comments: true,
        follows: true,
        groups: true,
        challenges: true,
      },
      setTheme: (theme) => set({ theme }),
      setMapStyle: (mapStyle) => set({ mapStyle }),
      setUnits: (units) => set({ units }),
      setNotifications: (partial) =>
        set((state) => ({
          notifications: { ...state.notifications, ...partial },
        })),
    }),
    {
      name: 'trailmate-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
