// lib/routeId.ts
// Prüft eine Routen-ID, bevor sie als recordings.route_id gespeichert wird.
// Router-Parameter können Text oder Array sein; Demo-Routen haben IDs wie
// `demo-1`, die es in der Datenbank nicht gibt. Nur UUIDs kommen durch.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeRouteId(value: unknown): string | null {
  const raw: unknown = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}
