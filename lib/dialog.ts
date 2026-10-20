// lib/dialog.ts
// Bestätigungs- und Auswahldialoge, die auch im Browser funktionieren.
//
// iOS/Android: Alert.alert mit Knöpfen.
// Web: react-native-web ignoriert die Knöpfe von Alert.alert, darum
// window.confirm bzw. eine nummerierte Auswahl über window.prompt.

import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface ChoiceOption {
  label: string;
  value: string;
  destructive?: boolean;
}

const DEFAULT_CANCEL = 'Abbrechen';

function joinText(title: string, message?: string): string {
  return message ? `${title}\n\n${message}` : title;
}

export function confirmAction({
  title,
  message,
  confirmText,
  cancelText = DEFAULT_CANCEL,
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      return Promise.resolve(false);
    }
    return Promise.resolve(window.confirm(joinText(title, message)));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function chooseAction(
  title: string,
  options: ChoiceOption[],
  message?: string,
): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
      return Promise.resolve(null);
    }
    const list = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
    const answer = window.prompt(`${joinText(title, message)}\n\n${list}`, '');
    const index = answer ? Number.parseInt(answer.trim(), 10) - 1 : -1;
    const picked = Number.isInteger(index) ? options[index] : undefined;
    return Promise.resolve(picked ? picked.value : null);
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        ...options.map((o) => ({
          text: o.label,
          style: o.destructive ? ('destructive' as const) : ('default' as const),
          onPress: () => resolve(o.value),
        })),
        { text: DEFAULT_CANCEL, style: 'cancel' as const, onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
