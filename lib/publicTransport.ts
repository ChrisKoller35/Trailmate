// ─── Public Transport (SBB/PT) Integration ────────────────
// Uses transport.opendata.ch API for Swiss public transport

const TRANSPORT_API = 'https://transport.opendata.ch/v1';

// ─── Types ─────────────────────────────────────────────────

export interface TransportConnection {
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  transfers: number;
  sections: TransportSection[];
  platform?: string;
}

export interface TransportSection {
  departure: { station: string; departure: string; platform?: string };
  arrival: { station: string; arrival: string; platform?: string };
  journey?: { name: string; category: string; number: string };
  walk?: number;
}

export interface TransportStation {
  id: string;
  name: string;
  coordinate: { x: number; y: number };
  distance?: number;
}

// ─── Station Lookup ────────────────────────────────────────

export async function findNearestStation(
  lat: number,
  lng: number,
): Promise<TransportStation | null> {
  // transport.opendata.ch uses x=latitude, y=longitude (counterintuitive but correct per API docs)
  const url = `${TRANSPORT_API}/locations?x=${lat}&y=${lng}&type=station`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Station lookup failed (${response.status})`);
  }

  const data = await response.json();
  const stations = data.stations;

  if (!stations || stations.length === 0) return null;

  const station = stations[0];
  return {
    id: station.id ?? '',
    name: station.name ?? '',
    coordinate: {
      x: station.coordinate?.x ?? 0,
      y: station.coordinate?.y ?? 0,
    },
    distance: station.distance ?? undefined,
  };
}

// ─── Connections ───────────────────────────────────────────

export async function getConnections(
  from: string,
  to: string,
  date: string,
  time: string,
  isArrival: boolean = false,
): Promise<TransportConnection[]> {
  const params = new URLSearchParams({
    from,
    to,
    date,
    time,
    isArrivalTime: isArrival ? '1' : '0',
    limit: '4',
  });

  const url = `${TRANSPORT_API}/connections?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Connection lookup failed (${response.status})`);
  }

  const data = await response.json();

  if (!data.connections || data.connections.length === 0) return [];

  return data.connections.map((conn: any): TransportConnection => {
    const fromCheckpoint = conn.from;
    const toCheckpoint = conn.to;

    return {
      from: fromCheckpoint?.station?.name ?? from,
      to: toCheckpoint?.station?.name ?? to,
      departure: fromCheckpoint?.departure ?? '',
      arrival: toCheckpoint?.arrival ?? '',
      duration: conn.duration ?? '',
      transfers: conn.transfers ?? 0,
      platform: fromCheckpoint?.platform ?? undefined,
      sections: (conn.sections ?? []).map((sec: any): TransportSection => ({
        departure: {
          station: sec.departure?.station?.name ?? '',
          departure: sec.departure?.departure ?? '',
          platform: sec.departure?.platform ?? undefined,
        },
        arrival: {
          station: sec.arrival?.station?.name ?? '',
          arrival: sec.arrival?.arrival ?? '',
          platform: sec.arrival?.platform ?? undefined,
        },
        journey: sec.journey
          ? {
              name: sec.journey.name ?? '',
              category: sec.journey.category ?? '',
              number: sec.journey.number ?? '',
            }
          : undefined,
        walk: sec.walk ? (sec.walk.duration ?? 0) : undefined,
      })),
    };
  });
}

// ─── SBB Deep Link ─────────────────────────────────────────

export function getSBBDeepLink(
  from: string,
  to: string,
  date: string,
  time: string,
): string {
  const params = new URLSearchParams({
    from,
    to,
    date,
    time,
  });
  return `https://www.sbb.ch/en/buying/pages/fahrplan/fahrplan.xhtml?${params.toString()}`;
}

// ─── Formatting ────────────────────────────────────────────

export function formatDuration(duration: string): string {
  // duration format from API: "00d01:30:00"
  const match = duration.match(/(\d+)d(\d+):(\d+):(\d+)/);
  if (match) {
    const days = parseInt(match[1], 10);
    const hours = parseInt(match[2], 10) + days * 24;
    const minutes = parseInt(match[3], 10);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}min`;
  }

  // Fallback: try HH:MM:SS format
  const simpleParts = duration.split(':');
  if (simpleParts.length === 3) {
    const hours = parseInt(simpleParts[0], 10);
    const minutes = parseInt(simpleParts[1], 10);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}min`;
  }

  return duration;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ─── Departure Suggestion ──────────────────────────────────

export function suggestDepartureTime(routeDurationMin: number): {
  departureTime: string;
  arrivalTime: string;
} {
  // Suggest departure so hiker arrives at trailhead by a reasonable morning time
  // Target: arrive at trailhead around 8:00-9:00 depending on route length
  const targetArrivalHour = routeDurationMin > 300 ? 7 : routeDurationMin > 180 ? 8 : 9;

  // Estimate 1h travel time to trailhead
  const departHour = Math.max(5, targetArrivalHour - 1);

  const departure = `${departHour.toString().padStart(2, '0')}:00`;
  const arrival = `${targetArrivalHour.toString().padStart(2, '0')}:00`;

  return { departureTime: departure, arrivalTime: arrival };
}
