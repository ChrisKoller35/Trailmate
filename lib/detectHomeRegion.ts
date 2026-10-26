// lib/detectHomeRegion.ts
// Schätzt die Heimatregion einmal über den Standort. Kein Dialog, kein Toast:
// ohne Freigabe, bei Fehlern oder nach Zeitüberschreitung kommt einfach null zurück.

import * as Location from 'expo-location';
import { regionFromCoordinates, type Region } from './regionFromCoordinates';

export async function detectHomeRegion(options: {
  requestPermission: boolean;
  timeoutMs?: number;
}): Promise<Region | null> {
  const { requestPermission, timeoutMs = 8000 } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted' && requestPermission) {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const locate = async () =>
      (await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const position = await Promise.race([locate(), timeout]);
    if (!position) return null;
    return regionFromCoordinates(position.coords.latitude, position.coords.longitude);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
