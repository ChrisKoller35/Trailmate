import type { TrackPoint } from '../types';
import { calculateDistance, spansManualPause, type ManualPause } from './trackingCalculations';

export interface ElevationProfilePoint {
  distance: number; // Meter ab Start
  elevation: number;
}

// Höhenprofil einer Aufzeichnung. Die Distanz läuft genau wie bei
// calculateTotalDistance: Schritte über eine manuelle Pause zählen nicht, Punkte
// ohne Höhe zählen für die Distanz, bekommen aber keinen Profilpunkt. So passt
// das Ende des Profils zur angezeigten Gesamtdistanz.
export function buildTrackElevationProfile(
  points: TrackPoint[],
  manualPauses: ManualPause[] = [],
  maxPoints = 300,
): ElevationProfilePoint[] {
  const profile: ElevationProfilePoint[] = [];
  let distance = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0 && !spansManualPause(points[i - 1].timestamp, p.timestamp, manualPauses)) {
      distance += calculateDistance(points[i - 1].latitude, points[i - 1].longitude, p.latitude, p.longitude);
    }
    if (p.altitude != null) profile.push({ distance, elevation: p.altitude });
  }
  if (profile.length < 2) return [];
  if (profile.length <= maxPoints) return profile;
  return thinByDistance(profile, Math.max(2, maxPoints));
}

// Gleichmässig nach Distanz ausdünnen; erster und letzter Punkt bleiben.
function thinByDistance(profile: ElevationProfilePoint[], maxPoints: number): ElevationProfilePoint[] {
  const first = profile[0];
  const last = profile[profile.length - 1];
  const step = (last.distance - first.distance) / (maxPoints - 1);
  if (step <= 0) return [first, last];

  const result: ElevationProfilePoint[] = [first];
  let next = first.distance + step;
  for (let i = 1; i < profile.length - 1; i++) {
    if (profile[i].distance >= next) {
      result.push(profile[i]);
      next = profile[i].distance + step;
    }
  }
  if (result.length >= maxPoints) result[result.length - 1] = last;
  else result.push(last);
  return result;
}
