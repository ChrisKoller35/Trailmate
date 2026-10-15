// hooks/usePermissions.ts
// Centralised permission handling for all platform capabilities.
//
// Each method follows this contract:
//   1. Query the current permission status.
//   2. If already granted → return true immediately (avoid re-prompting).
//   3. If undetermined → request the permission from the OS.
//   4. If the result is not granted (denied / blocked) → show an Alert with
//      a shortcut to the system Settings so the user can fix it manually.
//   5. Return false.

import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';

// ─── Helper ───────────────────────────────────────────────────────────────────

function showSettingsAlert(message: string): void {
  Alert.alert(
    'Berechtigung benötigt',
    message,
    [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Einstellungen öffnen', onPress: () => Linking.openSettings() },
    ],
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePermissions() {
  // ── Location (foreground) ──────────────────────────────────────────────────

  async function requestLocationPermission(): Promise<boolean> {
    const { status: current } = await Location.getForegroundPermissionsAsync();

    if (current === 'granted') return true;

    const { status: requested } = await Location.requestForegroundPermissionsAsync();

    if (requested !== 'granted') {
      showSettingsAlert('Bitte erlaube den Standortzugriff in den Einstellungen.');
      return false;
    }

    return true;
  }

  // ── GPS tracking (foreground + background) ────────────────────────────────

  async function requestTrackingPermissions(): Promise<boolean> {
    // Foreground is a prerequisite for background access.
    const { status: fgCurrent } = await Location.getForegroundPermissionsAsync();

    if (fgCurrent !== 'granted') {
      const { status: fgRequested } = await Location.requestForegroundPermissionsAsync();

      if (fgRequested !== 'granted') {
        showSettingsAlert('Standortzugriff wird für die GPS-Aufzeichnung benötigt.');
        return false;
      }
    }

    // Check background permission separately.
    const { status: bgCurrent } = await Location.getBackgroundPermissionsAsync();

    if (bgCurrent === 'granted') return true;

    const { status: bgRequested } = await Location.requestBackgroundPermissionsAsync();

    if (bgRequested !== 'granted') {
      showSettingsAlert('Hintergrundzugriff wird für kontinuierliche GPS-Aufzeichnung benötigt.');
      return false;
    }

    return true;
  }

  // ── Media library ─────────────────────────────────────────────────────────

  async function requestMediaLibraryPermission(): Promise<boolean> {
    const { status: current } = await ImagePicker.getMediaLibraryPermissionsAsync();

    if (current === 'granted') return true;

    const { status: requested } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (requested !== 'granted') {
      showSettingsAlert('Bitte erlaube den Zugriff auf deine Mediathek in den Einstellungen.');
      return false;
    }

    return true;
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  async function requestCameraPermission(): Promise<boolean> {
    const { status: current } = await ImagePicker.getCameraPermissionsAsync();

    if (current === 'granted') return true;

    const { status: requested } = await ImagePicker.requestCameraPermissionsAsync();

    if (requested !== 'granted') {
      showSettingsAlert('Bitte erlaube den Kamerazugriff in den Einstellungen.');
      return false;
    }

    return true;
  }

  // ── Push notifications ────────────────────────────────────────────────────

  async function requestNotificationPermission(): Promise<boolean> {
    const { status: current } = await Notifications.getPermissionsAsync();

    if (current === 'granted') return true;

    const { status: requested } = await Notifications.requestPermissionsAsync();

    if (requested !== 'granted') {
      showSettingsAlert('Bitte erlaube Push-Benachrichtigungen in den Einstellungen.');
      return false;
    }

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────

  return {
    requestLocationPermission,
    requestTrackingPermissions,
    requestMediaLibraryPermission,
    requestCameraPermission,
    requestNotificationPermission,
  };
}
