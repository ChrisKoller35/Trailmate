// ─── Shared Primitives ─────────────────────────────────────

export type MediaType = 'image' | 'video';

export interface MediaItem {
  url: string;
  type: MediaType;
  width?: number;
  height?: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
}
