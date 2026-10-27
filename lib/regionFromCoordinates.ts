// lib/regionFromCoordinates.ts
// Ordnet eine Position der nächstgelegenen Wanderregion aus REGIONS zu,
// ohne Netz und ohne Reverse-Geocoding (Luftlinie zu einem Mittelpunkt je Region).

import { REGIONS } from '../constants';
import { calculateDistance } from './trackingCalculations';

export type Region = (typeof REGIONS)[number];

export const REGION_CENTERS: Record<Region, { latitude: number; longitude: number }> = {
  'Berner Oberland': { latitude: 46.65, longitude: 7.85 },
  Wallis: { latitude: 46.25, longitude: 7.6 },
  'Graubünden / Engadin': { latitude: 46.7, longitude: 9.7 },
  Zentralschweiz: { latitude: 46.95, longitude: 8.45 },
  Ostschweiz: { latitude: 47.3, longitude: 9.3 },
  Tessin: { latitude: 46.2, longitude: 8.9 },
  Jura: { latitude: 47.25, longitude: 7.15 },
  'Zürich & Umgebung': { latitude: 47.38, longitude: 8.54 },
  'Basel & Umgebung': { latitude: 47.55, longitude: 7.6 },
  Emmental: { latitude: 46.95, longitude: 7.78 },
  'Fribourg / Freiburg': { latitude: 46.75, longitude: 7.1 },
};

/** Nächste Region zur Position; `null` bei ungültigen Zahlen oder wenn jeder Mittelpunkt weiter als `maxKm` weg ist. */
export function regionFromCoordinates(lat: number, lng: number, maxKm = 80): Region | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: Region | null = null;
  let bestMeters = maxKm * 1000;
  for (const region of REGIONS) {
    const center = REGION_CENTERS[region];
    const meters = calculateDistance(lat, lng, center.latitude, center.longitude);
    if (meters <= bestMeters) {
      best = region;
      bestMeters = meters;
    }
  }
  return best;
}
