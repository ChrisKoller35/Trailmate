import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { ExpoSecureStoreAdapter } from './secureStoreAdapter';
import { getSupabaseConfigError } from './supabaseConfig';

// Variablen wörtlich ausschreiben, sonst setzt Expo sie beim Bauen nicht ein.
export const supabaseConfigError = getSupabaseConfigError(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

if (supabaseConfigError) {
  console.error(`[supabase] Konfiguration unvollständig: ${supabaseConfigError}`);
}

// Der Client wird trotzdem erzeugt, damit Importe nicht abstürzen;
// app/_layout.tsx zeigt bei supabaseConfigError statt der App einen Hinweis.
const supabaseUrl = supabaseConfigError
  ? 'https://placeholder.supabase.co'
  : (process.env.EXPO_PUBLIC_SUPABASE_URL as string);
const supabaseAnonKey = supabaseConfigError
  ? 'placeholder'
  : (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS !== 'web' ? ExpoSecureStoreAdapter : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
