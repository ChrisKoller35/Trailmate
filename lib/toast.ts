// lib/toast.ts
// Minimal toast system usable by React Query and screens.
//
// Toasts live in stores/toastStore.ts and are rendered non-blocking by
// components/ui/ToastHost.tsx (mounted once in app/_layout.tsx). This works
// the same on iOS, Android and web (Alert.alert does nothing on web).

import { useToastStore, type ToastType } from '../stores/toastStore';

interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number; // ms; defaults to 3.5 s (errors: 5 s)
}

export function showToast(options: ToastOptions): void {
  const { title, message, type = 'info', duration } = options;
  const defaultTitle =
    type === 'error' ? 'Fehler' : type === 'success' ? 'Erfolg' : 'Hinweis';
  useToastStore.getState().show({ type, title: title ?? defaultTitle, message }, duration);
}

export function showErrorToast(message: string): void {
  showToast({ type: 'error', message });
}

export function showSuccessToast(message: string): void {
  showToast({ type: 'success', message });
}

export function showInfoToast(message: string): void {
  showToast({ type: 'info', message });
}
