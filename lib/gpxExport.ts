import { File, Paths } from 'expo-file-system';
import { supabase } from './supabase';
import { isTrustedStorageUrl } from './trustedFileUrl';
import type { Route } from '../types';
import type { TrackPoint } from '../types';

/**
 * Generate GPX XML string from a route and save it to a local file.
 * Returns the file URI for sharing.
 */
export async function exportRouteAsGPX(route: Route): Promise<string | null> {
  // Only fetch a stored GPX file from our own Supabase storage
  if (route.gpx_url && isTrustedStorageUrl(route.gpx_url, process.env.EXPO_PUBLIC_SUPABASE_URL)) {
    try {
      const response = await fetch(route.gpx_url);
      if (response.ok) {
        const gpxContent = await response.text();
        return await saveGPXFile(route.title ?? 'route', gpxContent);
      }
    } catch {
      // Fall through to generate from metadata
    }
  }

  // Generate minimal GPX from route data
  const name = escapeXml(route.title ?? 'TrailMate Route');
  const desc = escapeXml(route.description ?? '');
  const time = new Date(route.created_at).toISOString();

  let trackPoints = '';

  // Try to get route geometry from DB
  try {
    const { data } = await supabase.rpc('get_route_geojson', {
      route_id: route.id,
    });

    if (data?.coordinates && Array.isArray(data.coordinates)) {
      trackPoints = data.coordinates
        .map((coord: number[]) => {
          const [lng, lat, ele] = coord;
          return ele != null
            ? `        <trkpt lat="${lat}" lon="${lng}"><ele>${ele}</ele></trkpt>`
            : `        <trkpt lat="${lat}" lon="${lng}" />`;
        })
        .join('\n');
    }
  } catch {
    // No geometry available — create GPX with metadata only
  }

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailMate"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <desc>${desc}</desc>
    <time>${time}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <desc>${desc}</desc>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;

  return await saveGPXFile(route.title ?? 'route', gpx);
}

async function saveGPXFile(title: string, content: string): Promise<string> {
  const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const file = new File(Paths.cache, `${safeName}.gpx`);
  await file.write(content);
  return file.uri;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function exportRecordingAsGPX(
  points: TrackPoint[],
  title: string
): Promise<string> {
  const name = escapeXml(title);
  const time = new Date().toISOString();

  const trackPoints = points
    .map((p) => {
      const ele = p.altitude != null ? `<ele>${p.altitude}</ele>` : '';
      const t = `<time>${new Date(p.timestamp).toISOString()}</time>`;
      return `        <trkpt lat="${p.latitude}" lon="${p.longitude}">${ele}${t}</trkpt>`;
    })
    .join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailMate"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <time>${time}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;

  return await saveGPXFile(title, gpx);
}
