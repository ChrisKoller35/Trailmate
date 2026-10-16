// __tests__/usePermissions.test.ts
// Unit tests for the usePermissions hook.
//
// The hook has no state and no React context dependencies — it returns plain
// async functions.  We call those functions directly without renderHook,
// matching the style used throughout this test suite.

import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';

import { usePermissions } from '../hooks/usePermissions';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: { openSettings: jest.fn() },
}));

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  getCameraPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const granted = { status: 'granted' } as const;
const undetermined = { status: 'undetermined' } as const;
const denied = { status: 'denied' } as const;

function mockLocation(
  fgGet: { status: string },
  fgRequest?: { status: string },
  bgGet?: { status: string },
  bgRequest?: { status: string },
) {
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue(fgGet);
  if (fgRequest !== undefined)
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(fgRequest);
  if (bgGet !== undefined)
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue(bgGet);
  if (bgRequest !== undefined)
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue(bgRequest);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── requestLocationPermission ────────────────────────────────────────────────

describe('requestLocationPermission', () => {
  it('returns true immediately when already granted', async () => {
    mockLocation(granted);
    const { requestLocationPermission } = usePermissions();

    const result = await requestLocationPermission();

    expect(result).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('requests permission and returns true when undetermined → granted', async () => {
    mockLocation(undetermined, granted);
    const { requestLocationPermission } = usePermissions();

    const result = await requestLocationPermission();

    expect(result).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows settings alert and returns false when denied', async () => {
    mockLocation(undetermined, denied);
    const { requestLocationPermission } = usePermissions();

    const result = await requestLocationPermission();

    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Berechtigung benötigt',
      'Bitte erlaube den Standortzugriff in den Einstellungen.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Einstellungen öffnen' }),
      ]),
    );
  });
});

// ─── requestTrackingPermissions ───────────────────────────────────────────────

describe('requestTrackingPermissions', () => {
  it('returns true immediately when foreground and background are already granted', async () => {
    mockLocation(granted, undefined, granted);
    const { requestTrackingPermissions } = usePermissions();

    const result = await requestTrackingPermissions();

    expect(result).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('requests foreground and background when undetermined → both granted', async () => {
    mockLocation(undetermined, granted, undetermined, granted);
    const { requestTrackingPermissions } = usePermissions();

    const result = await requestTrackingPermissions();

    expect(result).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('returns false and shows alert when foreground is denied (background not queried)', async () => {
    mockLocation(undetermined, denied);
    const { requestTrackingPermissions } = usePermissions();

    const result = await requestTrackingPermissions();

    expect(result).toBe(false);
    expect(Location.getBackgroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Berechtigung benötigt',
      'Standortzugriff wird für die GPS-Aufzeichnung benötigt.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Einstellungen öffnen' }),
      ]),
    );
  });

  it('returns false and shows alert when foreground granted but background denied', async () => {
    mockLocation(granted, undefined, undetermined, denied);
    const { requestTrackingPermissions } = usePermissions();

    const result = await requestTrackingPermissions();

    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Berechtigung benötigt',
      'Hintergrundzugriff wird für kontinuierliche GPS-Aufzeichnung benötigt.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Einstellungen öffnen' }),
      ]),
    );
  });
});

// ─── requestMediaLibraryPermission ────────────────────────────────────────────

describe('requestMediaLibraryPermission', () => {
  it('returns true immediately when already granted', async () => {
    (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    const { requestMediaLibraryPermission } = usePermissions();

    const result = await requestMediaLibraryPermission();

    expect(result).toBe(true);
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('requests permission and returns true when undetermined → granted', async () => {
    (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue(undetermined);
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    const { requestMediaLibraryPermission } = usePermissions();

    const result = await requestMediaLibraryPermission();

    expect(result).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows settings alert and returns false when denied', async () => {
    (ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue(undetermined);
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue(denied);
    const { requestMediaLibraryPermission } = usePermissions();

    const result = await requestMediaLibraryPermission();

    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Berechtigung benötigt',
      'Bitte erlaube den Zugriff auf deine Mediathek in den Einstellungen.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Einstellungen öffnen' }),
      ]),
    );
  });
});

// ─── requestCameraPermission ──────────────────────────────────────────────────

describe('requestCameraPermission', () => {
  it('returns true immediately when already granted', async () => {
    (ImagePicker.getCameraPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    const { requestCameraPermission } = usePermissions();

    const result = await requestCameraPermission();

    expect(result).toBe(true);
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('requests permission and returns true when undetermined → granted', async () => {
    (ImagePicker.getCameraPermissionsAsync as jest.Mock).mockResolvedValue(undetermined);
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    const { requestCameraPermission } = usePermissions();

    const result = await requestCameraPermission();

    expect(result).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows settings alert and returns false when denied', async () => {
    (ImagePicker.getCameraPermissionsAsync as jest.Mock).mockResolvedValue(undetermined);
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue(denied);
    const { requestCameraPermission } = usePermissions();

    const result = await requestCameraPermission();

    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Berechtigung benötigt',
      'Bitte erlaube den Kamerazugriff in den Einstellungen.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Einstellungen öffnen' }),
      ]),
    );
  });
});

// ─── requestNotificationPermission ────────────────────────────────────────────

describe('requestNotificationPermission', () => {
  it('returns true immediately when already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    const { requestNotificationPermission } = usePermissions();

    const result = await requestNotificationPermission();

    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('requests permission and returns true when undetermined → granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(undetermined);
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue(granted);
    const { requestNotificationPermission } = usePermissions();

    const result = await requestNotificationPermission();

    expect(result).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows settings alert and returns false when denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(undetermined);
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue(denied);
    const { requestNotificationPermission } = usePermissions();

    const result = await requestNotificationPermission();

    expect(result).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Berechtigung benötigt',
      'Bitte erlaube Push-Benachrichtigungen in den Einstellungen.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Einstellungen öffnen' }),
      ]),
    );
  });
});
