// lib/tourShareText.ts
// Vorbereiteter, editierbarer Text, um eine aufgezeichnete Tour im Feed zu
// teilen. Beiträge haben keine Verbindung zu Aufzeichnungen, darum wird die
// Tour als Text geteilt (Titel + Zeile mit Distanz, Aufstieg und Gehzeit).

import { formatDistance, formatDuration } from './trackingCalculations';
import type { Badge } from '../types';

export const TOUR_SHARE_TEXT_MAX_LENGTH = 280;

export interface TourShareInput {
  title?: string | null;
  distanceM?: number | null;
  elevationGainM?: number | null;
  durationSeconds?: number | null;
  movingSeconds?: number | null;
}

/** Ganze Zahl mit Schweizer Tausendertrennzeichen, z. B. 1’250. */
export function formatSwissNumber(n: number): string {
  const str = Math.round(n).toString();
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, '’');
}

function isPositive(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function formatDurationSpaced(seconds: number): string {
  // «4h 12min» → «4 h 12 min»
  return formatDuration(seconds).replace(/(\d)([a-z])/g, '$1 $2');
}

export function buildTourShareText(input: TourShareInput): string {
  const title = input.title?.trim() || 'Meine Tour';

  const parts: string[] = [];
  if (isPositive(input.distanceM) && Math.round(input.distanceM) > 0) {
    parts.push(formatDistance(input.distanceM).replace('.', ','));
  }
  if (isPositive(input.elevationGainM) && Math.round(input.elevationGainM) > 0) {
    parts.push(`↑ ${formatSwissNumber(input.elevationGainM)} m`);
  }
  const seconds = isPositive(input.movingSeconds)
    ? input.movingSeconds
    : isPositive(input.durationSeconds)
      ? input.durationSeconds
      : null;
  if (seconds !== null && seconds >= 60) {
    parts.push(`${formatDurationSpaced(seconds)} unterwegs`);
  }

  const statsLine = parts.join(' · ');
  const maxTitle = statsLine
    ? TOUR_SHARE_TEXT_MAX_LENGTH - statsLine.length - 1
    : TOUR_SHARE_TEXT_MAX_LENGTH;
  const shortTitle =
    title.length > maxTitle ? `${title.slice(0, Math.max(0, maxTitle - 1)).trimEnd()}…` : title;

  const text = statsLine ? `${shortTitle}\n${statsLine}` : shortTitle;
  return text.slice(0, TOUR_SHARE_TEXT_MAX_LENGTH);
}

/** «Neues Abzeichen: 🏔️ Erster Gipfel 🏆» – ein Abzeichen als Text im Feed teilen. */
export function buildBadgeShareText(badge: Pick<Badge, 'name' | 'icon_url'>): string {
  const icon = badge.icon_url?.trim() || '🏅';
  const name = badge.name?.trim() || 'Abzeichen';
  return `Neues Abzeichen: ${icon} ${name} 🏆`;
}
