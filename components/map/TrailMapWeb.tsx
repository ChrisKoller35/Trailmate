import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import maplibregl from 'maplibre-gl';
import { Colors } from '../../constants';
import { ensureMapLibreCSS } from './maplibre-gl-css';
import { SWISSTOPO_RASTER_STYLE, SWISSTOPO_HIKING_TILES } from '../../lib/mapStyle';
import { boundsKey } from '../../lib/geoBounds';

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

interface TrailMapWebProps {
  children?: React.ReactNode;
  onPress?: (coordinate: [number, number]) => void;
  routeGeoJSON?: GeoJSON.FeatureCollection | GeoJSON.Feature | null;
  startPoint?: [number, number] | null;
  endPoint?: [number, number] | null;
  showHikingTrails?: boolean;
  /** Ort, zu dem die Karte fliegt und einen Such-Marker zeigt ([Länge, Breite]) */
  focusPoint?: [number, number] | null;
  focusZoom?: number;
  /** Grenzen, auf die sich die Karte einmal ausrichtet, wenn sie sich ändern */
  fitBounds?: { ne: [number, number]; sw: [number, number] } | null;
  style?: ViewStyle;
}

function createMarkerEl(color: string, label: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 28px; height: 28px; border-radius: 14px;
    background: ${color}; border: 2px solid #fff;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 13px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.25); cursor: pointer;
    line-height: 28px; text-align: center;
  `;
  el.textContent = label;
  return el;
}

export function TrailMapWeb({
  children,
  onPress,
  routeGeoJSON,
  startPoint,
  endPoint,
  showHikingTrails = true,
  focusPoint,
  focusZoom = 13,
  fitBounds,
  style,
}: TrailMapWebProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endMarkerRef = useRef<maplibregl.Marker | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const mapLoadedRef = useRef(false);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // Mount / Unmount
  useEffect(() => {
    ensureMapLibreCSS();
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SWISSTOPO_RASTER_STYLE as maplibregl.StyleSpecification,
      center: [8.2275, 46.8182],
      zoom: 8,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      mapLoadedRef.current = true;
      setLoading(false);

      // Hiking trails raster overlay
      map.addSource('hiking-trails-source', {
        type: 'raster',
        tiles: [SWISSTOPO_HIKING_TILES],
        tileSize: 256,
        minzoom: 10,
        maxzoom: 18,
      });
      map.addLayer({
        id: 'hiking-trails-layer',
        type: 'raster',
        source: 'hiking-trails-source',
        paint: { 'raster-opacity': showHikingTrails ? 0.55 : 0 },
      });

      // Route source (empty initially)
      map.addSource('route-source', {
        type: 'geojson',
        data: routeGeoJSON ?? EMPTY_FC,
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        paint: { 'line-color': '#FF6B35', 'line-width': 4 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    });

    map.on('error', (e) => {
      console.error('MapLibre error:', e.error?.message ?? e);
      if (!mapLoadedRef.current) {
        setLoading(false);
        setMapError(e.error?.message ?? 'Karte konnte nicht geladen werden');
      }
    });

    map.on('click', (e) => {
      onPressRef.current?.([e.lngLat.lng, e.lngLat.lat]);
    });

    mapRef.current = map;

    return () => {
      mapLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const src = map.getSource('route-source') as maplibregl.GeoJSONSource | undefined;
    src?.setData(routeGeoJSON ?? EMPTY_FC);
  }, [routeGeoJSON]);

  // Update start marker
  useEffect(() => {
    startMarkerRef.current?.remove();
    startMarkerRef.current = null;
    if (startPoint && mapRef.current) {
      const el = createMarkerEl('#16A34A', 'S');
      startMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(startPoint)
        .addTo(mapRef.current);
    }
  }, [startPoint]);

  // Update end marker
  useEffect(() => {
    endMarkerRef.current?.remove();
    endMarkerRef.current = null;
    if (endPoint && mapRef.current) {
      const el = createMarkerEl('#DC2626', 'Z');
      endMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(endPoint)
        .addTo(mapRef.current);
    }
  }, [endPoint]);

  // Fly to searched place and show search marker
  useEffect(() => {
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = null;
    const map = mapRef.current;
    if (!focusPoint || !map) return;
    const el = document.createElement('div');
    el.style.cssText = `
      width: 20px; height: 20px; border-radius: 10px;
      background: ${Colors.primary}; border: 3px solid #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
    `;
    searchMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat(focusPoint)
      .addTo(map);
    map.flyTo({ center: focusPoint, zoom: focusZoom });
  }, [focusPoint, focusZoom]);

  // Auf Grenzen ausrichten, nur wenn sie sich wirklich ändern
  const fitKey = boundsKey(fitBounds);
  useEffect(() => {
    const map = mapRef.current;
    if (!fitBounds || !map) return;
    map.fitBounds([fitBounds.sw, fitBounds.ne], { padding: 48, duration: 800 });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle hiking trails
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    if (map.getLayer('hiking-trails-layer')) {
      map.setPaintProperty('hiking-trails-layer', 'raster-opacity', showHikingTrails ? 0.55 : 0);
    }
  }, [showHikingTrails]);

  if (mapError) {
    return (
      <View style={[webStyles.container, style, webStyles.fallback]}>
        <Text style={webStyles.errorTitle}>Karten-Fehler</Text>
        <Text style={webStyles.fallbackText}>{mapError}</Text>
        {children}
      </View>
    );
  }

  return (
    <View style={[webStyles.container, style]}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />
      {loading && (
        <View style={webStyles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={webStyles.loadingText}>Karte wird geladen…</Text>
        </View>
      )}
      <View style={webStyles.childrenOverlay}>
        {children}
      </View>
    </View>
  );
}

const webStyles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative' as const,
  },
  fallback: {
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#c00',
    marginBottom: 8,
  },
  fallbackText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  childrenOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    pointerEvents: 'box-none' as const,
  },
});
