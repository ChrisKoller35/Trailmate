import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showErrorToast, showSuccessToast } from '../../lib/toast';
import { Colors } from '../../constants';
import { TrailMap } from '../../components/map/TrailMap';
import { RouteInfoPanel } from '../../components/map/RouteInfoPanel';
import { RouteFilterSheet } from '../../components/map/RouteFilterSheet';
import { ElevationProfile } from '../../components/map/ElevationProfile';
import { useRouting } from '../../hooks/useRouting';
import { useRouteFilter } from '../../hooks/useRouteFilter';
import { useRouteBookmarks } from '../../hooks/useRouteBookmarks';

type PlanningMode = 'idle' | 'set-start' | 'set-end' | 'set-waypoint';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MapScreen() {
  const [planningMode, setPlanningMode] = useState<PlanningMode>('idle');
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [showElevation, setShowElevation] = useState(false);
  const [showHikingTrails, setShowHikingTrails] = useState(true);

  const { calculateRoute, routeResult, isCalculating, error, clearRoute, loadDemoRoute } = useRouting();
  const { sacScales, fetchFilteredRoutes } = useRouteFilter();
  useRouteBookmarks();

  const handleMapPress = useCallback(
    (coordinate: [number, number]) => {
      if (planningMode === 'set-start') {
        setStartPoint(coordinate);
        setPlanningMode('set-end');
      } else if (planningMode === 'set-end') {
        setEndPoint(coordinate);
        setPlanningMode('idle');
      } else if (planningMode === 'set-waypoint') {
        setWaypoints((prev) => [...prev, coordinate]);
        setPlanningMode('idle');
      }
    },
    [planningMode],
  );

  const handleCalculateRoute = useCallback(async () => {
    if (!startPoint || !endPoint) {
      showErrorToast('Bitte setze Start- und Zielpunkt.');
      return;
    }
    await calculateRoute(startPoint, endPoint, {
      sacFilter: sacScales.length > 0 ? sacScales : undefined,
      waypoints: waypoints.length > 0 ? waypoints : undefined,
    });
  }, [startPoint, endPoint, sacScales, waypoints, calculateRoute]);

  const handleClearPlanning = useCallback(() => {
    setStartPoint(null);
    setEndPoint(null);
    setWaypoints([]);
    clearRoute();
    setPlanningMode('idle');
  }, [clearRoute]);

  const handleSaveRoute = useCallback(() => {
    if (routeResult) {
      showSuccessToast('Route wurde zur Merkliste hinzugefügt.');
    }
  }, [routeResult]);

  return (
    <View style={styles.container}>
      {/* Map */}
      <TrailMap
        onPress={handleMapPress}
        routeGeoJSON={routeResult?.geojson ?? null}
        startPoint={startPoint}
        endPoint={endPoint}
        showHikingTrails={showHikingTrails}
      />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          style={[
            styles.topBarButton,
            showHikingTrails && styles.topBarButtonActive,
          ]}
          onPress={() => setShowHikingTrails((v) => !v)}
        >
          <Ionicons
            name="trail-sign-outline"
            size={22}
            color={showHikingTrails ? Colors.surface : Colors.text}
          />
        </Pressable>
        <Pressable
          style={styles.topBarButton}
          onPress={() => setShowFilter(true)}
        >
          <Ionicons name="options-outline" size={22} color={Colors.text} />
        </Pressable>
      </View>

      {/* Planning Controls */}
      <View style={styles.planningBar}>
        {planningMode === 'idle' && !routeResult && (
          <>
            <Pressable
              style={[styles.planBtn, startPoint && styles.planBtnActive]}
              onPress={() => setPlanningMode('set-start')}
            >
              <Ionicons
                name="location"
                size={16}
                color={startPoint ? Colors.surface : Colors.success}
              />
              <Text
                style={[
                  styles.planBtnText,
                  startPoint && styles.planBtnTextActive,
                ]}
              >
                {startPoint ? 'Start ✓' : 'Start setzen'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.planBtn, endPoint && styles.planBtnActive]}
              onPress={() => setPlanningMode('set-end')}
            >
              <Ionicons
                name="flag"
                size={16}
                color={endPoint ? Colors.surface : Colors.error}
              />
              <Text
                style={[
                  styles.planBtnText,
                  endPoint && styles.planBtnTextActive,
                ]}
              >
                {endPoint ? 'Ziel ✓' : 'Ziel setzen'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.planBtn}
              onPress={() => setPlanningMode('set-waypoint')}
            >
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.planBtnText}>Zwischenstopp</Text>
            </Pressable>

            {startPoint && endPoint && (
              <Pressable
                style={[styles.planBtn, styles.goBtn]}
                onPress={handleCalculateRoute}
              >
                {isCalculating ? (
                  <ActivityIndicator size="small" color={Colors.surface} />
                ) : (
                  <>
                    <Ionicons name="navigate" size={16} color={Colors.surface} />
                    <Text style={styles.goBtnText}>Route</Text>
                  </>
                )}
              </Pressable>
            )}
          </>
        )}

        {(planningMode === 'set-start' || planningMode === 'set-end' || planningMode === 'set-waypoint') && (
          <View style={styles.tapHint}>
            <Ionicons name="hand-left-outline" size={18} color={Colors.primary} />
            <Text style={styles.tapHintText}>
              {planningMode === 'set-start'
                ? 'Tippe auf die Karte um den Startpunkt zu setzen'
                : planningMode === 'set-end'
                  ? 'Tippe auf die Karte um das Ziel zu setzen'
                  : 'Tippe auf die Karte für einen Zwischenstopp'}
            </Text>
            <Pressable onPress={() => setPlanningMode('idle')}>
              <Ionicons name="close-circle" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {routeResult && !showElevation && (
          <Pressable
            style={styles.clearButton}
            onPress={handleClearPlanning}
          >
            <Ionicons name="close-circle" size={18} color={Colors.error} />
            <Text style={styles.clearButtonText}>Route löschen</Text>
          </Pressable>
        )}
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Pressable style={styles.demoBtnInline} onPress={loadDemoRoute}>
            <Ionicons name="map-outline" size={16} color={Colors.primary} />
            <Text style={styles.demoBtnInlineText}>Demo-Route laden</Text>
          </Pressable>
        </View>
      )}

      {/* Demo Route Button (shown when idle with no route) */}
      {!routeResult && !error && planningMode === 'idle' && (
        <View style={styles.demoBar}>
          <Pressable style={styles.demoBtn} onPress={loadDemoRoute}>
            <Ionicons name="flask-outline" size={18} color={Colors.surface} />
            <Text style={styles.demoBtnText}>Demo-Route testen</Text>
          </Pressable>
        </View>
      )}

      {/* Route Info Panel */}
      {routeResult && !showElevation && (
        <View style={styles.infoPanel}>
          <RouteInfoPanel
            route={{
              distance_m: routeResult.distance_m,
              elevation_gain_m: routeResult.elevation_gain_m,
              elevation_loss_m: routeResult.elevation_loss_m,
              estimated_duration_min: routeResult.estimated_duration_min,
              sac_scale: routeResult.sac_scale,
              max_elevation_m: routeResult.max_elevation_m,
            }}
            onSave={handleSaveRoute}
            onShowElevation={() => setShowElevation(true)}
          />
        </View>
      )}

      {/* Elevation Profile Modal */}
      <Modal
        visible={showElevation}
        transparent
        animationType="slide"
        onRequestClose={() => setShowElevation(false)}
      >
        <Pressable
          style={styles.elevationOverlay}
          onPress={() => setShowElevation(false)}
        />
        <View style={styles.elevationSheet}>
          <View style={styles.elevationHeader}>
            <Text style={styles.elevationTitle}>Höhenprofil</Text>
            <Pressable onPress={() => setShowElevation(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          {routeResult?.elevationProfile && routeResult.elevationProfile.length > 0 ? (
            <ElevationProfile
              data={routeResult.elevationProfile}
              width={SCREEN_WIDTH - 32}
              height={200}
            />
          ) : (
            <Text style={styles.noDataText}>Keine Höhendaten verfügbar</Text>
          )}
        </View>
      </Modal>

      {/* Filter Sheet */}
      <RouteFilterSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={() => {
          fetchFilteredRoutes();
          setShowFilter(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    position: 'absolute',
    top: 56,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  topBarButton: {
    backgroundColor: Colors.surface,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  topBarButtonActive: {
    backgroundColor: Colors.primary,
  },
  planningBar: {
    position: 'absolute',
    top: 110,
    left: 12,
    right: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  planBtnActive: {
    backgroundColor: Colors.primary,
  },
  planBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  planBtnTextActive: {
    color: Colors.surface,
  },
  goBtn: {
    backgroundColor: Colors.primary,
  },
  goBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.surface,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
    flex: 1,
  },
  tapHintText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 180,
    left: 16,
    right: 16,
    alignItems: 'stretch',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.error,
  },
  demoBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  demoBtnInlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  demoBar: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  demoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.surface,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  elevationOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  elevationSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  elevationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  elevationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  noDataText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 40,
  },
});
