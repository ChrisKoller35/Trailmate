// lib/supabaseConfig.ts
// Prüft die Supabase-Umgebungsvariablen. Die Meldung nennt nur die Namen,
// nie die Werte (der Schlüssel soll nicht in Logs oder auf dem Bildschirm landen).

export function getSupabaseConfigError(
  url: string | undefined,
  anonKey: string | undefined,
): string | null {
  const problems: string[] = [];
  const trimmedUrl = url?.trim() ?? '';

  if (!trimmedUrl) {
    problems.push('EXPO_PUBLIC_SUPABASE_URL fehlt.');
  } else if (!/^https?:\/\//.test(trimmedUrl)) {
    problems.push('EXPO_PUBLIC_SUPABASE_URL muss mit https:// beginnen.');
  }
  if (!anonKey?.trim()) {
    problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY fehlt.');
  }

  return problems.length > 0 ? problems.join(' ') : null;
}
