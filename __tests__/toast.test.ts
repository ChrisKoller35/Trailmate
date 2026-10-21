import { showErrorToast, showInfoToast, showSuccessToast, showToast } from '@/lib/toast';
import { MAX_TOASTS, useToastStore } from '@/stores/toastStore';

const toasts = () => useToastStore.getState().toasts;

describe('lib/toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useToastStore.getState().clear();
  });

  afterEach(() => {
    useToastStore.getState().clear();
    jest.useRealTimers();
  });

  it('fügt Toasts mit Typ und Standardtitel hinzu', () => {
    showSuccessToast('Nachricht gesendet');
    showErrorToast('Schon gemeldet');
    showInfoToast('Hallo');
    expect(toasts()).toEqual([
      expect.objectContaining({ type: 'success', title: 'Erfolg', message: 'Nachricht gesendet' }),
      expect.objectContaining({ type: 'error', title: 'Fehler', message: 'Schon gemeldet' }),
      expect.objectContaining({ type: 'info', title: 'Hinweis', message: 'Hallo' }),
    ]);
  });

  it('übernimmt einen eigenen Titel', () => {
    showToast({ title: 'Limit', message: 'Zu viele Beiträge', type: 'error' });
    expect(toasts()[0]).toMatchObject({ title: 'Limit', type: 'error' });
  });

  it('entfernt Hinweise nach 3,5 s und Fehler nach 5 s', () => {
    showSuccessToast('ok');
    showErrorToast('kaputt');
    jest.advanceTimersByTime(3499);
    expect(toasts()).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(toasts().map((t) => t.message)).toEqual(['kaputt']);
    jest.advanceTimersByTime(1500);
    expect(toasts()).toHaveLength(0);
  });

  it('respektiert eine eigene Dauer', () => {
    showToast({ message: 'kurz', duration: 1000 });
    jest.advanceTimersByTime(1000);
    expect(toasts()).toHaveLength(0);
  });

  it('zeigt höchstens drei Toasts gleichzeitig (neueste bleiben)', () => {
    ['1', '2', '3', '4', '5'].forEach((m) => showInfoToast(m));
    expect(MAX_TOASTS).toBe(3);
    expect(toasts().map((t) => t.message)).toEqual(['3', '4', '5']);
    jest.advanceTimersByTime(3500);
    expect(toasts()).toHaveLength(0);
  });

  it('schliesst einen Toast per dismiss', () => {
    showInfoToast('a');
    showInfoToast('b');
    const [first] = toasts();
    useToastStore.getState().dismiss(first.id);
    expect(toasts().map((t) => t.message)).toEqual(['b']);
    // Timer des geschlossenen Toasts darf nichts mehr kaputt machen
    jest.advanceTimersByTime(3500);
    expect(toasts()).toHaveLength(0);
  });
});
