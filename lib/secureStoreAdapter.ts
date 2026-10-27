// lib/secureStoreAdapter.ts
// Speicher-Adapter für die Supabase-Session. Alle Funktionen geben die Promise
// zurück, damit supabase-js darauf warten kann und Fehler beim Aufrufer ankommen.

import * as SecureStore from 'expo-secure-store';

export const ExpoSecureStoreAdapter = {
  getItem: (key: string): Promise<string | null> => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string): Promise<void> => SecureStore.setItemAsync(key, value),
  removeItem: (key: string): Promise<void> => SecureStore.deleteItemAsync(key),
};
