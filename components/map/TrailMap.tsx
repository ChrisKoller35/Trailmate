import React, { useRef, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Colors } from '../../constants';

// Lazy-load web map to avoid bundling maplibre-gl on native
const TrailMapWeb = Platform.OS === 'web'
  ? require('./TrailMapWeb').TrailMapWeb
  : null;
import {
  MapView,
  Camera,
  UserLocation,
  ShapeSource,
  LineLayer,
  PointAnnotation,
  RasterSource,
  RasterLayer,
  mapLibreAvailable,
  mapLibreError,
} from '../../lib/maplibre';
import { SWISSTOPO_STYLE_JSON, SWISSTOPO_HIKING_TILES } from '../../lib/mapStyle';

interface TrailMapProps {
  children?: React.ReactNode;
  onPress?: (coordinate: [number, number]) => void;
  routeGeoJSON?: GeoJSON.FeatureCollection | GeoJSON.Feature | null;
  startPoint?: [number, number] | null;
  endPoint?: [number, number] | null;
  showHikingTrails?: boolean;
  /** Ort, zu dem die Karte fliegt und einen Such-Marker zeigt ([Länge, Breite]) */
  focusPoint?: [number, number] | null;
  focusZoom?: number;
  style?: ViewStyle;
}

export function TrailMap({
  children,
  onPress,
  routeGeoJSON,
  startPoint,
  endPoint,
  showHikingTrails = true,
  focusPoint,
  focusZoom = 13,
  style,
}: TrailMapProps) {
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Zum gesuchten Ort fliegen
  useEffect(() => {
    if (!focusPoint || Platform.OS === 'web') return;
    cameraRef.current?.setCamera({
      centerCoordinate: focusPoint,
      zoomLevel: focusZoom,
      animationMode: 'flyTo',
      animationDuration: 1200,
    });
  }, [focusPoint, focusZoom]);

  const handlePress = useCallback(
    (event: any) => {
      if (onPress && event.geometry?.coordinates) {
        onPress(event.geometry.coordinates as [number, number]);
      }
    },
    [onPress],
  );

  if (Platform.OS === 'web') {
    if (TrailMapWeb) {
      return (
        <TrailMapWeb
          onPress={onPress}
          routeGeoJSON={routeGeoJSON}
          startPoint={startPoint}
          endPoint={endPoint}
          showHikingTrails={showHikingTrails}
          focusPoint={focusPoint}
          focusZoom={focusZoom}
          style={style}
        >
          {children}
        </TrailMapWeb>
      );
    }
    return (
      <View style={[styles.map, style, styles.fallback]}>
        <Text style={styles.fallbackText}>Karte (nur auf Gerät verfügbar)</Text>
        {children}
      </View>
    );
  }

  if (!mapLibreAvailable) {
    return (
      <View style={[styles.map, style, styles.fallback]}>
        <Text style={styles.errorTitle}>MapLibre nicht verfügbar</Text>
        <Text style={styles.fallbackText}>{mapLibreError}</Text>
        <Text style={styles.fallbackHint}>
          Du brauchst einen neuen Dev-Build:{'\n'}npx expo run:android{'\n'}oder: eas build --profile development --platform android
        </Text>
        {children}
      </View>
    );
  }

  if (mapError) {
    return (
      <View style={[styles.map, style, styles.fallback]}>
        <Text style={styles.errorTitle}>Karten-Fehler</Text>
        <Text style={styles.fallbackText}>{mapError}</Text>
        {children}
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, style]}
      mapStyle={SWISSTOPO_STYLE_JSON}
      logoEnabled={false}
      attributionEnabled={false}
      onPress={handlePress}
      onDidFailLoadingMap={(e: any) => {
        const msg =
          e?.payload?.message ??
          e?.message ??
          e?.nativeEvent?.message ??
          (typeof e === 'string' ? e : JSON.stringify(e));
        setMapError(msg);
      }}
    >
      <Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: [8.2275, 46.8182],
          zoomLevel: 8,
        }}
      />

      <UserLocation visible />

      {/* Swisstopo official hiking trails overlay */}
      {RasterSource && RasterLayer && (
        <RasterSource
          id="hiking-trails-source"
          tileUrlTemplates={[
            SWISSTOPO_HIKING_TILES,
          ]}
          tileSize={256}
          minZoomLevel={10}
          maxZoomLevel={18}
        >
          <RasterLayer
            id="hiking-trails-layer"
            style={{
              rasterOpacity: showHikingTrails ? 0.55 : 0,
            }}
            belowLayerID="route-line"
          />
        </RasterSource>
      )}

      {routeGeoJSON && (
        <ShapeSource id="route-source" shape={routeGeoJSON}>
          <LineLayer
            id="route-line"
            style={{
              lineColor: '#FF6B35',
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      )}

      {focusPoint && (
        <PointAnnotation id="search-point" coordinate={focusPoint}>
          <View style={[styles.marker, styles.searchMarker]} />
        </PointAnnotation>
      )}

      {startPoint && (
        <PointAnnotation id="start-point" coordinate={startPoint}>
          <View style={[styles.marker, styles.startMarker]}>
            <Text style={styles.markerText}>S</Text>
          </View>
        </PointAnnotation>
      )}

      {endPoint && (
        <PointAnnotation id="end-point" coordinate={endPoint}>
          <View style={[styles.marker, styles.endMarker]}>
            <Text style={styles.markerText}>Z</Text>
          </View>
        </PointAnnotation>
      )}

      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
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
    marginBottom: 8,
  },
  fallbackHint: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  searchMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    backgroundColor: Colors.primary,
  },
  startMarker: {
    backgroundColor: Colors.success,
  },
  endMarker: {
    backgroundColor: Colors.error,
  },
  markerText: {
    color: Colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
});
