// lib/trustedFileUrl.ts
// Prüft, ob eine Datei-Adresse (z. B. routes.gpx_url) im eigenen
// Supabase-Speicher liegt. Nur solche Adressen lädt die App selbst.

const PUBLIC_STORAGE_PATH = '/storage/v1/object/public/';

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isTrustedStorageUrl(url: string, supabaseUrl: string | undefined): boolean {
  if (!supabaseUrl) return false;
  const file = parseUrl(url);
  const base = parseUrl(supabaseUrl);
  if (!file || !base) return false;
  if (file.username || file.password) return false;
  return (
    file.protocol === base.protocol &&
    file.hostname === base.hostname &&
    file.port === base.port &&
    file.pathname.startsWith(PUBLIC_STORAGE_PATH)
  );
}
