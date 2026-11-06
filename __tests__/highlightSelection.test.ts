// __tests__/highlightSelection.test.ts
import { MAX_HIGHLIGHTS, moveHighlightUp, toggleHighlight } from '../lib/highlightSelection';

describe('toggleHighlight', () => {
  it('appends a new tour and removes a selected one', () => {
    expect(toggleHighlight(['a'], 'b')).toEqual({ selected: ['a', 'b'], rejected: false });
    expect(toggleHighlight(['a', 'b', 'c'], 'b')).toEqual({ selected: ['a', 'c'], rejected: false });
  });

  it('rejects a sixth tour and keeps the selection', () => {
    const full = ['a', 'b', 'c', 'd', 'e'];
    expect(full).toHaveLength(MAX_HIGHLIGHTS);
    expect(toggleHighlight(full, 'f')).toEqual({ selected: full, rejected: true });
    expect(toggleHighlight(full, 'c')).toEqual({ selected: ['a', 'b', 'd', 'e'], rejected: false });
  });
});

describe('moveHighlightUp', () => {
  it('moves a tour one place up', () => {
    expect(moveHighlightUp(['a', 'b', 'c'], 'c')).toEqual(['a', 'c', 'b']);
  });

  it('keeps the first and unknown tours in place', () => {
    expect(moveHighlightUp(['a', 'b'], 'a')).toEqual(['a', 'b']);
    expect(moveHighlightUp(['a', 'b'], 'x')).toEqual(['a', 'b']);
  });
});
