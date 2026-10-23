// ─── Ortssuche (swisstopo SearchServer) ───────────────────
// Freie Suche ohne Schlüssel: https://api3.geo.admin.ch/rest/services/api/SearchServer

const SEARCH_API = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

export const PLACE_SEARCH_MIN_LENGTH = 2;
export const PLACE_SEARCH_LIMIT = 8;

// ─── Types ─────────────────────────────────────────────────

export type PlaceKind =
  | 'Ort'
  | 'Gemeinde'
  | 'Adresse'
  | 'Flurname'
  | 'Bezirk'
  | 'Kanton'
  | 'Parzelle';

export interface Place {
  id: string;
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
  kind: PlaceKind;
}

interface SearchResultAttrs {
  label?: string;
  lat?: number;
  lon?: number;
  origin?: string;
  detail?: string;
  featureId?: string | number;
}

interface SearchResponse {
  results?: { id?: string | number; attrs?: SearchResultAttrs }[];
}

// ─── Helpers ───────────────────────────────────────────────

const ORIGIN_KIND: Record<string, PlaceKind> = {
  zipcode: 'Ort',
  gg25: 'Gemeinde',
  address: 'Adresse',
  gazetteer: 'Flurname',
  district: 'Bezirk',
  kantone: 'Kanton',
  parcel: 'Parzelle',
};

export function kindFromOrigin(origin: string | undefined): PlaceKind {
  return (origin && ORIGIN_KIND[origin]) || 'Ort';
}

/** Entfernt HTML-Tags (z. B. `<b>`) und überflüssige Leerzeichen aus einem Label. */
export function stripTags(label: string): string {
  return label
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ort → `[Länge, Breite]`, wie ihn Karte und Routenplanung erwarten. */
export function placeToCoordinate(place: Place): [number, number] {
  return [place.longitude, place.latitude];
}

export function isAbortError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { name?: string }).name === 'AbortError'
  );
}

// ─── Search ────────────────────────────────────────────────

export async function searchPlaces(
  query: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Place[]> {
  const text = query.trim();
  if (text.length < PLACE_SEARCH_MIN_LENGTH) return [];

  const url =
    `${SEARCH_API}?searchText=${encodeURIComponent(text)}` +
    `&type=locations&sr=4326&limit=${PLACE_SEARCH_LIMIT}&lang=de`;

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new Error('Ortssuche nicht erreichbar. Bitte prüfe deine Internetverbindung.');
  }

  if (!response.ok) {
    throw new Error(`Ortssuche fehlgeschlagen (Fehler ${response.status}). Bitte versuche es später erneut.`);
  }

  let data: SearchResponse;
  try {
    data = (await response.json()) as SearchResponse;
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new Error('Ortssuche lieferte eine ungültige Antwort.');
  }

  const places: Place[] = [];
  (data.results ?? []).forEach((result, index) => {
    const attrs = result.attrs;
    if (!attrs || typeof attrs.lat !== 'number' || typeof attrs.lon !== 'number') return;
    const name = stripTags(attrs.label ?? '');
    if (!name) return;
    places.push({
      id: `${attrs.origin ?? 'place'}-${result.id ?? attrs.featureId ?? index}`,
      name,
      detail: attrs.detail ?? '',
      latitude: attrs.lat,
      longitude: attrs.lon,
      kind: kindFromOrigin(attrs.origin),
    });
  });
  return places.slice(0, PLACE_SEARCH_LIMIT);
}
