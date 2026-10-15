import { calculateScore, type ScoredPost } from '../lib/feedAlgorithm';

// ─── Helper function ──────────────────────────────────────────────────────────

function makePost(overrides: Partial<ScoredPost> = {}): ScoredPost {
  return {
    created_at: new Date().toISOString(), // just created → minimal recency decay
    likes_count: 0,
    comments_count: 0,
    saves_count: 0,
    _home_region: undefined,
    ...overrides,
  };
}

// ─── Base scoring ─────────────────────────────────────────────────────────────

describe('calculateScore', () => {
  it('returns 0 for a post with no engagement', () => {
    expect(calculateScore(makePost(), null)).toBe(0);
  });

  it('likes contribute 2× to score', () => {
    const withLikes = calculateScore(makePost({ likes_count: 10 }), null);
    const withComments = calculateScore(makePost({ comments_count: 10 }), null);
    // 10 likes × 2 = 20 engagement; 10 comments × 3 = 30 engagement
    // likes score should be lower than comments score
    expect(withLikes).toBeLessThan(withComments);
  });

  it('saves contribute 4× (highest weight)', () => {
    const withSaves = calculateScore(makePost({ saves_count: 5 }), null);
    const withLikes = calculateScore(makePost({ likes_count: 5 }), null);
    const withComments = calculateScore(makePost({ comments_count: 5 }), null);
    expect(withSaves).toBeGreaterThan(withComments);
    expect(withSaves).toBeGreaterThan(withLikes);
  });

  it('higher engagement yields a higher score (same age)', () => {
    const lowEngagement = calculateScore(
      makePost({ likes_count: 1, comments_count: 0, saves_count: 0 }),
      null,
    );
    const highEngagement = calculateScore(
      makePost({ likes_count: 100, comments_count: 50, saves_count: 20 }),
      null,
    );
    expect(highEngagement).toBeGreaterThan(lowEngagement);
  });

  // ─── Recency-Decay ──────────────────────────────────────────────────────────

  it('newer posts score higher than older posts with identical engagement', () => {
    const newPost = makePost({
      likes_count: 10,
      created_at: new Date().toISOString(), // now
    });
    const oldPost = makePost({
      likes_count: 10,
      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
    });
    expect(calculateScore(newPost, null)).toBeGreaterThan(calculateScore(oldPost, null));
  });

  it('score decreases as post gets older', () => {
    const engagement = { likes_count: 20, comments_count: 10, saves_count: 5 };
    const score1h = calculateScore(
      makePost({ ...engagement, created_at: new Date(Date.now() - 1 * 3600_000).toISOString() }),
      null,
    );
    const score24h = calculateScore(
      makePost({ ...engagement, created_at: new Date(Date.now() - 24 * 3600_000).toISOString() }),
      null,
    );
    const score168h = calculateScore(
      makePost({ ...engagement, created_at: new Date(Date.now() - 168 * 3600_000).toISOString() }),
      null,
    );
    expect(score1h).toBeGreaterThan(score24h);
    expect(score24h).toBeGreaterThan(score168h);
  });

  // ─── Region-Boost ───────────────────────────────────────────────────────────

  it('same region gives exactly 1.5× boost over different region', () => {
    const post = makePost({ likes_count: 10, _home_region: 'Berner Oberland' });
    const sameRegion = calculateScore(post, 'Berner Oberland');
    const diffRegion = calculateScore(post, 'Wallis');
    expect(sameRegion / diffRegion).toBeCloseTo(1.5, 5);
  });

  it('no boost when userRegion is null', () => {
    const post = makePost({ likes_count: 10, _home_region: 'Berner Oberland' });
    const noRegion = calculateScore(post, null);
    const diffRegion = calculateScore(post, 'Wallis');
    // Both should use factor 1.0
    expect(noRegion).toBeCloseTo(diffRegion, 5);
  });

  it('no boost when userRegion is undefined', () => {
    const post = makePost({ likes_count: 10, _home_region: 'Berner Oberland' });
    const noRegion = calculateScore(post, undefined);
    const diffRegion = calculateScore(post, 'Wallis');
    expect(noRegion).toBeCloseTo(diffRegion, 5);
  });

  it('no boost when post has no _home_region', () => {
    const post = makePost({ likes_count: 10, _home_region: undefined });
    const withRegion = calculateScore(post, 'Berner Oberland');
    const noRegion = calculateScore(post, null);
    // Both should be equal since post has no region
    expect(withRegion).toBeCloseTo(noRegion, 5);
  });

  // ─── Combined properties ────────────────────────────────────────────────────

  it('regional boost on top of recency for a fresh local post', () => {
    const localPost = makePost({
      likes_count: 10,
      created_at: new Date().toISOString(),
      _home_region: 'Wallis',
    });
    const foreignOldPost = makePost({
      likes_count: 10,
      created_at: new Date(Date.now() - 48 * 3600_000).toISOString(),
      _home_region: 'Zürich',
    });
    const localScore = calculateScore(localPost, 'Wallis');
    const foreignScore = calculateScore(foreignOldPost, 'Wallis');
    expect(localScore).toBeGreaterThan(foreignScore);
  });
});
