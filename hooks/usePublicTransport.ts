import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  defaultTravelDate,
  describeTransportError,
  findNearestStation,
  getConnections,
  getSBBDeepLink,
  suggestDepartureTime,
  type TransportStation,
  type TransportConnection,
} from '../lib/publicTransport';
import { queryKeys } from '../lib/queryKeys';

// ─── Types ─────────────────────────────────────────────────

interface UsePublicTransportReturn {
  startStation: TransportStation | null;
  endStation: TransportStation | null;
  outboundConnections: TransportConnection[];
  returnConnections: TransportConnection[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  isLoading: boolean;
  error: string | null;
  refreshConnections: () => void;
  sbbLink: string | null;
}

// ─── Helpers ───────────────────────────────────────────────

class StationNotFoundError extends Error {}

function describeError(err: unknown): string {
  if (err instanceof StationNotFoundError) return 'Keine Haltestelle in der Nähe gefunden.';
  // navigator.onLine only exists in the browser; React Native leaves it undefined
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return describeTransportError(err, offline ? false : undefined);
}

// ─── Hook ──────────────────────────────────────────────────

export function usePublicTransport(
  _routeId?: string,
  startLat?: number,
  startLng?: number,
  endLat?: number,
  endLng?: number,
  routeDurationMin?: number,
): UsePublicTransportReturn {
  const [selectedDate, setSelectedDate] = useState(() => defaultTravelDate());
  const [selectedTime, setSelectedTime] = useState('08:00');

  // Set suggested departure time based on route duration
  useEffect(() => {
    if (routeDurationMin) {
      const suggestion = suggestDepartureTime(routeDurationMin);
      setSelectedTime(suggestion.departureTime);
    }
  }, [routeDurationMin]);

  // ─── Stations query ──────────────────────────────────────
  const stationsQuery = useQuery({
    queryKey: queryKeys.transport.stations(startLat!, startLng!, endLat, endLng),
    queryFn: async (): Promise<{ start: TransportStation; end: TransportStation }> => {
      const start = await findNearestStation(startLat!, startLng!);
      if (!start) throw new StationNotFoundError('No station found');

      let end: TransportStation = start;
      if (endLat !== undefined && endLng !== undefined) {
        const foundEnd = await findNearestStation(endLat!, endLng!);
        if (foundEnd) end = foundEnd;
      }

      return { start, end };
    },
    enabled: startLat !== undefined && startLng !== undefined,
    staleTime: 24 * 60 * 60 * 1000, // stations don't move — cache for 24 h
  });

  const startStation = stationsQuery.data?.start ?? null;
  const endStation = stationsQuery.data?.end ?? null;

  // ─── Connections query ───────────────────────────────────
  const returnHour = routeDurationMin
    ? Math.min(20, Math.floor(parseInt(selectedTime.split(':')[0], 10) + 1 + routeDurationMin / 60))
    : 16;
  const returnTime = `${returnHour.toString().padStart(2, '0')}:00`;

  const connectionsQuery = useQuery({
    // returnTime must be in the key — it is used in the queryFn and can change
    // independently of selectedTime when routeDurationMin changes.
    queryKey: [
      ...queryKeys.transport.connections(
        startStation?.name ?? '',
        endStation?.name ?? '',
        selectedDate,
        selectedTime,
      ),
      returnTime,
    ],
    queryFn: async (): Promise<{ outbound: TransportConnection[]; returnConns: TransportConnection[] }> => {
      const [outbound, returnConns] = await Promise.all([
        getConnections(startStation!.name, endStation!.name, selectedDate, selectedTime, false),
        getConnections(endStation!.name, startStation!.name, selectedDate, returnTime, false),
      ]);
      return { outbound, returnConns };
    },
    enabled: !!startStation && !!endStation,
    staleTime: 5 * 60 * 1000, // timetable data — cache for 5 min
  });

  const outboundConnections = connectionsQuery.data?.outbound ?? [];
  const returnConnections = connectionsQuery.data?.returnConns ?? [];

  const isLoading = stationsQuery.isLoading || connectionsQuery.isLoading;

  const error = useMemo(() => {
    if (stationsQuery.error) return describeError(stationsQuery.error);
    if (connectionsQuery.error) return describeError(connectionsQuery.error);
    return null;
  }, [stationsQuery.error, connectionsQuery.error]);

  // refetch ignores `enabled`: without stations the connections query would
  // run with missing names, so load the stations first.
  const refreshConnections = useCallback(() => {
    if (startLat === undefined || startLng === undefined) return;
    if (!stationsQuery.data || stationsQuery.isError) {
      stationsQuery.refetch();
    } else {
      connectionsQuery.refetch();
    }
  }, [startLat, startLng, stationsQuery, connectionsQuery]);

  const sbbLink = useMemo(() => {
    if (!startStation || !endStation) return null;
    return getSBBDeepLink(
      startStation.name,
      endStation.name,
      selectedDate,
      selectedTime,
    );
  }, [startStation, endStation, selectedDate, selectedTime]);

  return {
    startStation,
    endStation,
    outboundConnections,
    returnConnections,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    isLoading,
    error,
    refreshConnections,
    sbbLink,
  };
}
