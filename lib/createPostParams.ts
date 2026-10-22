// lib/createPostParams.ts
// Liest die Parameter von /create-post (useLocalSearchParams) und verwirft
// alles, was nicht passt: IDs müssen UUIDs sein, und ein Beitrag gehört
// höchstens in eine Gruppe oder eine Community.

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface CreatePostParams {
  text: string | null;
  routeId: string | null;
  groupId: string | null;
  communityId: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function first(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' ? v : null;
}

function uuidParam(value: string | string[] | undefined): string | null {
  const v = first(value)?.trim();
  return v && isUuid(v) ? v : null;
}

export function parseCreatePostParams(params: RawSearchParams): CreatePostParams {
  const text = first(params.text);
  let groupId = uuidParam(params.groupId);
  let communityId = uuidParam(params.communityId);
  if (groupId && communityId) {
    groupId = null;
    communityId = null;
  }
  return {
    text: text && text.trim() ? text : null,
    routeId: uuidParam(params.routeId),
    groupId,
    communityId,
  };
}
