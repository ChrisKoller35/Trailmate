import * as Location from 'expo-location';
import { detectHomeRegion } from '../lib/detectHomeRegion';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const mocked = Location as jest.Mocked<typeof Location>;

function grant(status: 'granted' | 'denied') {
  mocked.getForegroundPermissionsAsync.mockResolvedValue({ status } as Location.LocationPermissionResponse);
}

describe('detectHomeRegion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('gibt ohne Freigabe null zurück, ohne zu fragen oder eine Position abzurufen', async () => {
    grant('denied');
    await expect(detectHomeRegion({ requestPermission: false })).resolves.toBeNull();
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.getLastKnownPositionAsync).not.toHaveBeenCalled();
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('erkennt das Berner Oberland aus der letzten bekannten Position in Interlaken', async () => {
    grant('granted');
    mocked.getLastKnownPositionAsync.mockResolvedValue({
      coords: { latitude: 46.686, longitude: 7.863 },
    } as Location.LocationObject);
    await expect(detectHomeRegion({ requestPermission: false })).resolves.toBe('Berner Oberland');
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('gibt nach timeoutMs null zurück, wenn keine Position kommt', async () => {
    jest.useFakeTimers();
    grant('granted');
    mocked.getLastKnownPositionAsync.mockResolvedValue(null);
    mocked.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));
    const result = detectHomeRegion({ requestPermission: false, timeoutMs: 5000 });
    await jest.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toBeNull();
  });
});
