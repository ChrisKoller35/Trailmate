import { validatePostContent, BLOCKED_WORDS } from '../hooks/useModeration';

// The word filter is pure; the hook's backend and store are not needed here.
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../stores/authStore', () => ({ useAuthStore: jest.fn() }));

// ─── validatePostContent ──────────────────────────────────────────────────────

describe('validatePostContent', () => {
  it('approves normal hiking text', () => {
    expect(validatePostContent('Schöne Tour auf den Niesen, Wetter perfekt!')).toEqual({
      status: 'approved',
    });
  });

  it('approves empty content', () => {
    expect(validatePostContent('')).toEqual({ status: 'approved' });
  });

  it('blocks a listed word and names it', () => {
    expect(validatePostContent('Das ist doch Betrug')).toEqual({
      status: 'blocked',
      blockedWord: 'betrug',
    });
  });

  it('is case-insensitive', () => {
    expect(validatePostContent('SPAM SPAM SPAM').status).toBe('blocked');
  });

  it('blocks words next to punctuation', () => {
    expect(validatePostContent('Idiot!').blockedWord).toBe('idiot');
    expect(validatePostContent('(scam)').blockedWord).toBe('scam');
  });

  it('does not block words that only contain a listed word', () => {
    expect(validatePostContent('Heilbronn ist weit weg').status).toBe('approved');
    expect(validatePostContent('Spamalot im Kino').status).toBe('approved');
    expect(validatePostContent('Die Fakten zur Route').status).toBe('approved');
  });

  it('blocks every entry of the word list', () => {
    for (const word of BLOCKED_WORDS) {
      expect(validatePostContent(`vorher ${word} nachher`)).toEqual({
        status: 'blocked',
        blockedWord: word,
      });
    }
  });
});
