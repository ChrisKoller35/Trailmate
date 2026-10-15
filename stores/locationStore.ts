// locationStore.ts
//
// Single source of truth for the user's current GPS position.
//
// Tracking-related fields (isTracking, trackingData, trackingStartedAt,
// startTracking, stopTracking, addTrackPoint, resetTracking) were removed
// because recordingStore.ts now fully owns that responsibility:
//   - status           ↔ isTracking
//   - trackPoints      ↔ trackingData
//   - startedAt        ↔ trackingStartedAt
//
// This store exclusively holds the last known location, used by e.g.
// map components or the map screen.

import { create } from 'zustand';
import type { GeoPoint } from '../types';

interface LocationState {
  currentLocation: GeoPoint | null;
  setLocation: (location: GeoPoint) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLocation: null,
  setLocation: (currentLocation) => set({ currentLocation }),
}));
