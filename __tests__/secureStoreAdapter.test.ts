import * as SecureStore from 'expo-secure-store';

import { ExpoSecureStoreAdapter } from '../lib/secureStoreAdapter';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mocked = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(() => jest.clearAllMocks());

describe('ExpoSecureStoreAdapter', () => {
  it('getItem gibt den gespeicherten Wert zurück', async () => {
    mocked.getItemAsync.mockResolvedValue('wert');
    await expect(ExpoSecureStoreAdapter.getItem('k')).resolves.toBe('wert');
    expect(mocked.getItemAsync).toHaveBeenCalledWith('k');
  });

  it('setItem gibt die Promise von expo-secure-store zurück', async () => {
    const p = Promise.resolve();
    mocked.setItemAsync.mockReturnValue(p);
    expect(ExpoSecureStoreAdapter.setItem('k', 'v')).toBe(p);
    expect(mocked.setItemAsync).toHaveBeenCalledWith('k', 'v');
  });

  it('removeItem gibt die Promise von expo-secure-store zurück', async () => {
    const p = Promise.resolve();
    mocked.deleteItemAsync.mockReturnValue(p);
    expect(ExpoSecureStoreAdapter.removeItem('k')).toBe(p);
    expect(mocked.deleteItemAsync).toHaveBeenCalledWith('k');
  });

  it('Fehler beim Speichern kommt beim Aufrufer an', async () => {
    mocked.setItemAsync.mockRejectedValue(new Error('Keychain gesperrt'));
    await expect(ExpoSecureStoreAdapter.setItem('k', 'v')).rejects.toThrow('Keychain gesperrt');
  });

  it('Fehler beim Löschen kommt beim Aufrufer an', async () => {
    mocked.deleteItemAsync.mockRejectedValue(new Error('Keychain gesperrt'));
    await expect(ExpoSecureStoreAdapter.removeItem('k')).rejects.toThrow('Keychain gesperrt');
  });
});
