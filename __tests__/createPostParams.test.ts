// __tests__/createPostParams.test.ts
// Unit tests for parseCreatePostParams (lib/createPostParams).

import { parseCreatePostParams } from '../lib/createPostParams';

const ROUTE = '11111111-2222-4333-8444-555555555555';
const GROUP = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const COMMUNITY = 'AAAAAAAA-BBBB-4CCC-8DDD-FFFFFFFFFFFF';

describe('parseCreatePostParams', () => {
  it('returns nulls for empty params', () => {
    expect(parseCreatePostParams({})).toEqual({
      text: null,
      routeId: null,
      groupId: null,
      communityId: null,
    });
  });

  it('reads plain string values', () => {
    expect(
      parseCreatePostParams({ text: 'Pilatus\n12,4 km', routeId: ROUTE, groupId: GROUP }),
    ).toEqual({ text: 'Pilatus\n12,4 km', routeId: ROUTE, groupId: GROUP, communityId: null });
  });

  it('takes the first entry of arrays', () => {
    expect(
      parseCreatePostParams({ text: ['a', 'b'], routeId: [ROUTE, 'x'], communityId: [COMMUNITY] }),
    ).toEqual({ text: 'a', routeId: ROUTE, groupId: null, communityId: COMMUNITY });
    expect(parseCreatePostParams({ text: [] }).text).toBeNull();
  });

  it('drops invalid UUIDs', () => {
    expect(
      parseCreatePostParams({
        routeId: 'not-a-uuid',
        groupId: `${GROUP}x`,
        communityId: "1' or '1'='1",
      }),
    ).toEqual({ text: null, routeId: null, groupId: null, communityId: null });
  });

  it('drops blank text', () => {
    expect(parseCreatePostParams({ text: '   ' }).text).toBeNull();
  });

  it('drops both IDs when group and community are set', () => {
    const p = parseCreatePostParams({ groupId: GROUP, communityId: COMMUNITY, routeId: ROUTE });
    expect(p.groupId).toBeNull();
    expect(p.communityId).toBeNull();
    expect(p.routeId).toBe(ROUTE);
  });

  it('keeps a valid group when the community ID is invalid', () => {
    const p = parseCreatePostParams({ groupId: GROUP, communityId: 'kaputt' });
    expect(p.groupId).toBe(GROUP);
    expect(p.communityId).toBeNull();
  });
});
