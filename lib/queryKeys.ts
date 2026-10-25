export const queryKeys = {
  feed: {
    main: (userId: string) => ['feed', 'main', userId] as const,
    explore: (userId: string) => ['feed', 'explore', userId] as const,
  },
  posts: {
    likes: (userId: string) => ['posts', 'likes', userId] as const,
    bookmarks: (userId: string) => ['posts', 'bookmarks', userId] as const,
    comments: (postId: string) => ['posts', 'comments', postId] as const,
    routeBookmarks: (userId: string) => ['posts', 'routeBookmarks', userId] as const,
    savedRoutes: (userId: string) => ['posts', 'savedRoutes', userId] as const,
  },
  follow: {
    requests: (userId: string) => ['follow', 'requests', userId] as const,
    status: (userId: string, targetId: string) => ['follow', 'status', userId, targetId] as const,
  },
  blocks: (userId: string) => ['blocks', userId] as const,
  dms: {
    conversations: (userId: string) => ['dms', 'conversations', userId] as const,
    messages: (userId: string, otherId: string) => ['dms', 'messages', userId, otherId] as const,
  },
  postMessages: {
    inbox: (userId: string) => ['postMessages', 'inbox', userId] as const,
  },
  communities: {
    mine: (userId: string) => ['communities', 'mine', userId] as const,
    suggested: (userId: string) => ['communities', 'suggested', userId] as const,
    detail: (communityId: string) => ['communities', 'detail', communityId] as const,
    role: (userId: string, communityId: string) => ['communities', 'role', userId, communityId] as const,
  },
  groups: {
    mine: (userId: string) => ['groups', 'mine', userId] as const,
    detail: (groupId: string) => ['groups', 'detail', groupId] as const,
    role: (userId: string, groupId: string) => ['groups', 'role', userId, groupId] as const,
  },
  events: {
    upcoming: (userId: string) => ['events', 'upcoming', userId] as const,
    responses: (eventId: string) => ['events', 'responses', eventId] as const,
  },
  trailConditions: (routeId: string) => ['trailConditions', routeId] as const,
  routeGeometry: (routeId: string) => ['routeGeometry', routeId] as const,
  weather: (lat: number, lng: number) => ['weather', lat, lng] as const,
  transport: {
    stations: (startLat: number, startLng: number, endLat?: number, endLng?: number) =>
      ['transport', 'stations', startLat, startLng, endLat, endLng] as const,
    connections: (startName: string, endName: string, date: string, time: string) =>
      ['transport', 'connections', startName, endName, date, time] as const,
  },
  offlineMaps: () => ['offlineMaps'] as const,
} as const;
