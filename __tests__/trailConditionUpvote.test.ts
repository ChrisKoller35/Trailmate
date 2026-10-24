// __tests__/trailConditionUpvote.test.ts
// Unit tests for getUpvoteState in hooks/useTrailConditions: decides whether
// the «Hilfreich» button is hidden (own report), filled (already voted) or open.

import { getUpvoteState } from '../hooks/useTrailConditions';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/storage', () => ({ uploadTrailConditionPhoto: jest.fn() }));
jest.mock('../lib/toast', () => ({ showErrorToast: jest.fn() }));
jest.mock('../stores/authStore', () => ({ useAuthStore: jest.fn() }));

const report = { id: 'r1', user_id: 'author' };

describe('getUpvoteState', () => {
  it('returns own for the own report, even if a vote exists', () => {
    expect(getUpvoteState(report, 'author', new Set())).toBe('own');
    expect(getUpvoteState(report, 'author', new Set(['r1']))).toBe('own');
  });

  it('returns voted once the own vote is counted', () => {
    expect(getUpvoteState(report, 'me', new Set(['r1']))).toBe('voted');
  });

  it('returns open when not voted yet', () => {
    expect(getUpvoteState(report, 'me', new Set(['other']))).toBe('open');
  });

  it('does not treat a report without author as own when logged out', () => {
    expect(getUpvoteState({ id: 'r1', user_id: null }, undefined, new Set())).toBe('open');
  });
});
