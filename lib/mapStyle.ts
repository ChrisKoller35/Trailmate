/**
 * Swisstopo Pixelkarte (Landeskarte 1:25'000) – Raster base map via WMS
 * Shows hiking trails, contour lines, and terrain detail directly on the map.
 * Uses WMS (not WMTS) because the Pixelkarte WMTS only supports Swiss projection (LV03),
 * while MapLibre requires Web Mercator (EPSG:3857). WMS reprojects on-the-fly.
 */

const SWISSTOPO_PIXELKARTE_WMS =
  'https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo.pixelkarte-farbe&FORMAT=image/jpeg&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256';

export const SWISSTOPO_HIKING_TILES =
  'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-wanderwege/default/current/3857/{z}/{x}/{y}.png';

/** MapLibre style object for the Swisstopo Pixelkarte via WMS */
export const SWISSTOPO_RASTER_STYLE: Record<string, unknown> = {
  version: 8,
  name: 'Swisstopo Pixelkarte',
  sources: {
    'swisstopo-pixelkarte': {
      type: 'raster',
      tiles: [SWISSTOPO_PIXELKARTE_WMS],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 18,
      attribution: '© swisstopo',
    },
  },
  layers: [
    {
      id: 'swisstopo-base',
      type: 'raster',
      source: 'swisstopo-pixelkarte',
    },
  ],
};

/** JSON-stringified style for native MapView (accepts JSON string) */
export const SWISSTOPO_STYLE_JSON = JSON.stringify(SWISSTOPO_RASTER_STYLE);

/** Data-URI style URL for OfflineManager (requires a fetchable URL, not raw JSON) */
export const SWISSTOPO_STYLE_URI = `data:application/json;charset=utf-8,${encodeURIComponent(SWISSTOPO_STYLE_JSON)}`;
