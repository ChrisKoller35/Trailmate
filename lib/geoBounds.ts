// lib/geoBounds.ts
// Grenzen einer Linie für Camera.fitBounds(ne, sw, …). Koordinaten sind
// [lng, lat] oder [lng, lat, höhe]; die Höhe wird ignoriert.

export function lineBounds(
  coordinates: number[][],
): { ne: [number, number]; sw: [number, number] } | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coordinates) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  if (minLng === Infinity) return null;
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}
