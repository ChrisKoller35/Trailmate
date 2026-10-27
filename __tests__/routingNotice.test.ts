// __tests__/routingNotice.test.ts
// Unit tests for confirmRoutingNotice: asks once, remembers the consent.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { confirmAction } from '../lib/dialog';
import { confirmRoutingNotice, ROUTING_NOTICE_KEY } from '../lib/routingNotice';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../lib/dialog', () => ({ confirmAction: jest.fn() }));

const confirmMock = confirmAction as jest.MockedFunction<typeof confirmAction>;

beforeEach(async () => {
  confirmMock.mockReset();
  await AsyncStorage.clear();
});

describe('confirmRoutingNotice', () => {
  it('asks the first time, remembers consent and skips the dialog afterwards', async () => {
    confirmMock.mockResolvedValueOnce(true);

    await expect(confirmRoutingNotice()).resolves.toBe(true);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock.mock.calls[0][0]).toMatchObject({
      title: 'Route berechnen',
      confirmText: 'Verstanden',
    });
    expect(confirmMock.mock.calls[0][0].message).toContain('brouter.de');
    expect(await AsyncStorage.getItem(ROUTING_NOTICE_KEY)).not.toBeNull();

    await expect(confirmRoutingNotice()).resolves.toBe(true);
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it('returns false on cancel and asks again next time', async () => {
    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(confirmRoutingNotice()).resolves.toBe(false);
    expect(await AsyncStorage.getItem(ROUTING_NOTICE_KEY)).toBeNull();

    await expect(confirmRoutingNotice()).resolves.toBe(true);
    expect(confirmMock).toHaveBeenCalledTimes(2);
  });

  it('treats a read error as not seen and does not throw', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('storage broken'));
    confirmMock.mockResolvedValueOnce(true);

    await expect(confirmRoutingNotice()).resolves.toBe(true);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
