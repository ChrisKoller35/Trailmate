// lib/highlightSelection.ts
// Auswahl der Highlight-Touren im Profil: höchstens 5, die Reihenfolge der
// Liste wird beim Speichern zu highlight_tours.sort_order.

export const MAX_HIGHLIGHTS = 5;

export function toggleHighlight(
  selected: string[],
  recordingId: string,
): { selected: string[]; rejected: boolean } {
  if (selected.includes(recordingId)) {
    return { selected: selected.filter((id) => id !== recordingId), rejected: false };
  }
  if (selected.length >= MAX_HIGHLIGHTS) return { selected, rejected: true };
  return { selected: [...selected, recordingId], rejected: false };
}

export function moveHighlightUp(selected: string[], recordingId: string): string[] {
  const index = selected.indexOf(recordingId);
  if (index <= 0) return selected;
  const next = [...selected];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}
