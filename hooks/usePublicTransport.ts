import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
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

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [selectedDate, setSelectedDate] = useState(getTodayDateString);
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
      if (!start) throw new Error('Station konnte nicht gefunden werden');

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
    if (stationsQuery.error instanceof Error) return stationsQuery.error.message;
    if (connectionsQuery.error instanceof Error) return connectionsQuery.error.message;
    return null;
  }, [stationsQuery.error, connectionsQuery.error]);

  const refreshConnections = useCallback(
    () => { connectionsQuery.refetch(); },
    [connectionsQuery],
  );

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
