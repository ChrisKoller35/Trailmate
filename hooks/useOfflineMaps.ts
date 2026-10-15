import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { OfflineManager } from '../lib/maplibre';
import { queryKeys } from '../lib/queryKeys';

import { SWISSTOPO_STYLE_URI } from '../lib/mapStyle';

export interface OfflineRegion {
  id: string;
  name: string;
  bounds: [[number, number], [number, number]]; // [[sw_lng, sw_lat], [ne_lng, ne_lat]]
  minZoom: number;
  maxZoom: number;
  estimatedSizeMB: number;
  isDownloaded: boolean;
}

const PREDEFINED_REGIONS: Omit<OfflineRegion, 'isDownloaded'>[] = [
  {
    id: 'berner-oberland',
    name: 'Berner Oberland',
    bounds: [[7.3, 46.4], [8.3, 46.85]],
    minZoom: 8,
    maxZoom: 14,
    estimatedSizeMB: 180,
  },
  {
    id: 'wallis',
    name: 'Wallis',
    bounds: [[6.8, 45.95], [8.5, 46.45]],
    minZoom: 8,
    maxZoom: 14,
    estimatedSizeMB: 200,
  },
  {
    id: 'graubuenden',
    name: 'Graubünden / Engadin',
    bounds: [[8.6, 46.3], [10.5, 47.1]],
    minZoom: 8,
    maxZoom: 14,
    estimatedSizeMB: 220,
  },
  {
    id: 'zentralschweiz',
    name: 'Zentralschweiz',
    bounds: [[7.8, 46.7], [8.9, 47.2]],
    minZoom: 8,
    maxZoom: 14,
    estimatedSizeMB: 130,
  },
  {
    id: 'ostschweiz',
    name: 'Ostschweiz',
    bounds: [[8.8, 46.8], [9.9, 47.7]],
    minZoom: 8,
    maxZoom: 14,
    estimatedSizeMB: 150,
  },
  {
    id: 'tessin',
    name: 'Tessin',
    bounds: [[8.4, 45.8], [9.2, 46.6]],
    minZoom: 8,
    maxZoom: 14,
    estimatedSizeMB: 110,
  },
  {
    id: 'jura',
    name: 'Jura',
    bounds: [[5.9, 46.8], [7.7, 47.5]],
    minZoom: 8,
    maxZoom: 14,
    estimatedSizeMB: 140,
  },
];

export function useOfflineMaps() {
  const queryClient = useQueryClient();
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  // ─── Regions query ───────────────────────────────────────
  const regionsQuery = useQuery({
    queryKey: queryKeys.offlineMaps(),
    queryFn: async (): Promise<OfflineRegion[]> => {
      try {
        const packs = await OfflineManager.getPacks();
        const downloadedIds = new Set((packs ?? []).map((p: any) => p.name as string));
        return PREDEFINED_REGIONS.map((r) => ({ ...r, isDownloaded: downloadedIds.has(r.id) }));
      } catch {
        // Offline manager not available (e.g. on web) – show all as not downloaded
        return PREDEFINED_REGIONS.map((r) => ({ ...r, isDownloaded: false }));
      }
    },
    staleTime: 0, // Always refetch - reflects device storage state
  });

  const regions = regionsQuery.data ?? PREDEFINED_REGIONS.map((r) => ({ ...r, isDownloaded: false }));

  const totalStorageMB = useMemo(
    () => regions.filter((r) => r.isDownloaded).reduce((sum, r) => sum + r.estimatedSizeMB, 0),
    [regions],
  );

  const refreshDownloaded = useCallback(
    () => { regionsQuery.refetch(); },
    [regionsQuery],
  );

  const downloadRegion = useCallback(
    async (regionId: string) => {
      const region = PREDEFINED_REGIONS.find((r) => r.id === regionId);
      if (!region) return;

      setDownloadProgress((prev) => ({ ...prev, [regionId]: 0 }));

      try {
        await OfflineManager.createPack(
          {
            name: region.id,
            styleURL: SWISSTOPO_STYLE_URI,
            bounds: region.bounds,
            minZoom: region.minZoom,
            maxZoom: region.maxZoom,
          },
          (_pack: any, status: any) => {
            const pct =
              status.percentage != null
                ? status.percentage
                : (status.completedResourceCount / Math.max(status.requiredResourceCount, 1)) * 100;
            setDownloadProgress((prev) => ({ ...prev, [regionId]: pct }));

            if (pct >= 100) {
              setDownloadProgress((prev) => {
                const next = { ...prev };
                delete next[regionId];
                return next;
              });
              queryClient.invalidateQueries({ queryKey: queryKeys.offlineMaps() });
            }
          },
          (_pack: any, err: any) => {
            console.error('Download error:', err);
            setDownloadProgress((prev) => {
              const next = { ...prev };
              delete next[regionId];
              return next;
            });
          },
        );
      } catch (err) {
        console.error('Failed to create offline pack:', err);
        setDownloadProgress((prev) => {
          const next = { ...prev };
          delete next[regionId];
          return next;
        });
      }
    },
    [queryClient],
  );

  const deleteRegion = useCallback(
    async (regionId: string) => {
      try {
        await OfflineManager.deletePack(regionId);
        queryClient.invalidateQueries({ queryKey: queryKeys.offlineMaps() });
      } catch (err) {
        console.error('Failed to delete offline pack:', err);
      }
    },
    [queryClient],
  );

  return {
    regions,
    downloadProgress,
    totalStorageMB,
    downloadRegion,
    deleteRegion,
    refreshDownloaded,
  };
}
