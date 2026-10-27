// lib/routingNotice.ts
// Einmaliger Hinweis vor der ersten Routenberechnung: Start, Ziel und
// Zwischenpunkte gehen an BRouter (brouter.de). Die Zustimmung wird gemerkt.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { confirmAction } from './dialog';

export const ROUTING_NOTICE_KEY = '@trailmate-brouter-hinweis';

async function hasSeenNotice(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ROUTING_NOTICE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function confirmRoutingNotice(): Promise<boolean> {
  if (await hasSeenNotice()) return true;

  const ok = await confirmAction({
    title: 'Route berechnen',
    message:
      'Start, Ziel und Zwischenpunkte gehen zur Berechnung an den Dienst BRouter (brouter.de). ' +
      'Mehr dazu unter Einstellungen > Datenschutz.',
    confirmText: 'Verstanden',
  });
  if (!ok) return false;

  try {
    await AsyncStorage.setItem(ROUTING_NOTICE_KEY, '1');
  } catch {
    // Not remembered — the notice simply shows again next time
  }
  return true;
}
