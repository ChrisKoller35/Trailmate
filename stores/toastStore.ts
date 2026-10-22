import { create } from 'zustand';

export type ToastType = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

export const MAX_TOASTS = 3;
export const DEFAULT_DURATION_MS = 3500;
export const ERROR_DURATION_MS = 5000;

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>, durationMs?: number) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function clearTimer(id: number) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (toast, durationMs) => {
    const id = nextId++;
    const all = [...get().toasts, { ...toast, id }];
    // Keep only the newest MAX_TOASTS; drop timers of the removed ones.
    const dropped = all.slice(0, Math.max(0, all.length - MAX_TOASTS));
    dropped.forEach((t) => clearTimer(t.id));
    set({ toasts: all.slice(-MAX_TOASTS) });

    const duration =
      durationMs ?? (toast.type === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), duration),
    );
    return id;
  },
  dismiss: (id) => {
    clearTimer(id);
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  clear: () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    set({ toasts: [] });
  },
}));
