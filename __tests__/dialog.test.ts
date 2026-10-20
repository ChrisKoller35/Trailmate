import { Alert, Platform } from 'react-native';
import { chooseAction, confirmAction } from '@/lib/dialog';

type AlertButtons = Parameters<typeof Alert.alert>[2];

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

function lastButtons(spy: jest.SpyInstance): NonNullable<AlertButtons> {
  const call = spy.mock.calls[spy.mock.calls.length - 1];
  return call[2] as NonNullable<AlertButtons>;
}

describe('lib/dialog', () => {
  const originalOS = Platform.OS;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    setPlatform(originalOS);
  });

  describe('nativ (ios)', () => {
    beforeEach(() => setPlatform('ios'));

    it('confirmAction löst mit true auf, wenn bestätigt wird', async () => {
      const promise = confirmAction({ title: 'Löschen', confirmText: 'Löschen', destructive: true });
      const buttons = lastButtons(alertSpy);
      expect(buttons[1]).toMatchObject({ text: 'Löschen', style: 'destructive' });
      buttons[1].onPress?.();
      await expect(promise).resolves.toBe(true);
    });

    it('confirmAction löst mit false auf, wenn abgebrochen wird', async () => {
      const promise = confirmAction({ title: 'Löschen', confirmText: 'Löschen' });
      const buttons = lastButtons(alertSpy);
      expect(buttons[0]).toMatchObject({ text: 'Abbrechen', style: 'cancel' });
      buttons[0].onPress?.();
      await expect(promise).resolves.toBe(false);
    });

    it('chooseAction liefert den Wert der gewählten Option', async () => {
      const promise = chooseAction('Mitglied', [
        { label: 'Zum Mod machen', value: 'mod' },
        { label: 'Entfernen', value: 'remove', destructive: true },
      ]);
      const buttons = lastButtons(alertSpy);
      expect(buttons).toHaveLength(3);
      expect(buttons[1].style).toBe('destructive');
      buttons[1].onPress?.();
      await expect(promise).resolves.toBe('remove');
    });

    it('chooseAction liefert null bei Abbruch', async () => {
      const promise = chooseAction('Mitglied', [{ label: 'A', value: 'a' }]);
      lastButtons(alertSpy)[1].onPress?.();
      await expect(promise).resolves.toBeNull();
    });
  });

  describe('web', () => {
    let confirmSpy: jest.Mock;
    let promptSpy: jest.Mock;

    beforeEach(() => {
      setPlatform('web');
      confirmSpy = jest.fn();
      promptSpy = jest.fn();
      Object.assign(window, { confirm: confirmSpy, prompt: promptSpy });
    });

    it('confirmAction nutzt window.confirm', async () => {
      confirmSpy.mockReturnValue(true);
      await expect(
        confirmAction({ title: 'Blockieren', message: 'Sicher?', confirmText: 'Blockieren' }),
      ).resolves.toBe(true);
      expect(confirmSpy).toHaveBeenCalledWith('Blockieren\n\nSicher?');
      expect(alertSpy).not.toHaveBeenCalled();

      confirmSpy.mockReturnValue(false);
      await expect(confirmAction({ title: 'X', confirmText: 'OK' })).resolves.toBe(false);
    });

    it('chooseAction wertet die eingegebene Nummer aus', async () => {
      promptSpy.mockReturnValue(' 2 ');
      const options = [
        { label: 'Entfernen', value: 'remove' },
        { label: 'Blockieren', value: 'block' },
      ];
      await expect(chooseAction('Follower', options)).resolves.toBe('block');
      expect(promptSpy.mock.calls[0][0]).toContain('1. Entfernen\n2. Blockieren');
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('chooseAction liefert null bei Abbruch oder ungültiger Eingabe', async () => {
      promptSpy.mockReturnValue(null);
      const options = [{ label: 'A', value: 'a' }];
      await expect(chooseAction('T', options)).resolves.toBeNull();
      promptSpy.mockReturnValue('5');
      await expect(chooseAction('T', options)).resolves.toBeNull();
      promptSpy.mockReturnValue('abc');
      await expect(chooseAction('T', options)).resolves.toBeNull();
    });
  });
});
