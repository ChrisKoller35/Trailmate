// lib/toast.ts
// Minimal toast system usable by React Query and screens.
//
// Current implementation: Alert.alert (cross-platform, no extra package needed).
// Can later be swapped for a real toast library (e.g. react-native-toast-message)
// without changing the public function call signatures.

import { Alert } from 'react-native';

type ToastType = 'error' | 'success' | 'info';

interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number; // ignored by Alert.alert, present for future library compatibility
}

export function showToast(options: ToastOptions): void {
  const { title, message, type = 'info' } = options;
  const prefix =
    type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ';
  const defaultTitle =
    type === 'error' ? 'Fehler' : type === 'success' ? 'Erfolg' : 'Hinweis';
  Alert.alert(title ?? defaultTitle, prefix + message);
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
