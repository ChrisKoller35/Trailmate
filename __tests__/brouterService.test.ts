import { analyzeElevation } from '../lib/brouterService';

// Grad Breite pro Meter entlang eines Meridians (gleicher Erdradius wie im Service)
const DEG_PER_M = 180 / (Math.PI * 6371000);

describe('analyzeElevation', () => {
  // 125 Punkte im Abstand von gut 100 m nach Norden: etwa 12.4 km,
  // bis zur Mitte 10 m pro Punkt hinauf, danach wieder hinunter.
  const coords = Array.from({ length: 125 }, (_, i) => [
    8.2,
    46.8 + i * 100.2 * DEG_PER_M,
    1000 + 10 * Math.min(i, 124 - i),
  ]);

  it('liefert die Profil-Distanz in Metern', () => {
    const { elevationProfile } = analyzeElevation(coords);
    const last = elevationProfile[elevationProfile.length - 1];
    expect(elevationProfile[0].distance).toBe(0);
    expect(Math.abs(last.distance - 12400)).toBeLessThanOrEqual(50);
  });

  it('setzt etwa alle 100 m einen Profilpunkt', () => {
    const { elevationProfile } = analyzeElevation(coords);
    expect(elevationProfile).toHaveLength(125);
    for (let i = 1; i < elevationProfile.length; i++) {
      const step = elevationProfile[i].distance - elevationProfile[i - 1].distance;
      expect(step).toBeGreaterThanOrEqual(99);
      expect(step).toBeLessThanOrEqual(102);
    }
  });

  it('berechnet Aufstieg, Abstieg und höchsten Punkt', () => {
    const result = analyzeElevation(coords);
    expect(result.elevation_gain_m).toBe(620);
    expect(result.elevation_loss_m).toBe(620);
    expect(result.max_elevation_m).toBe(1620);
  });
});
