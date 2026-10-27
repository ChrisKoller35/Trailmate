import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MapView, Camera, ShapeSource, LineLayer, mapLibreAvailable } from '../lib/maplibre';
import { TrailMap } from '../components/map/TrailMap';
import { Colors } from '../constants';
import { SWISSTOPO_STYLE_JSON } from '../lib/mapStyle';
import { useRecordingDetail, useDeleteRecording } from '../hooks/useRecordingDetail';
import { recordingLineFeature } from '../lib/recordingLine';
import { lineBounds } from '../lib/geoBounds';
import { formatDistance, formatDuration } from '../lib/trackingCalculations';
import { confirmAction } from '../lib/dialog';
import { showSuccessToast } from '../lib/toast';

function orDash<T>(value: T | null, format: (v: T) => string): string {
  return value == null ? '–' : format(value);
}

export default function RecordingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useRecordingDetail(id ?? null);
  const { deleteRecording, isDeleting } = useDeleteRecording();

  const line = useMemo(() => recordingLineFeature(data?.geom), [data?.geom]);
  const bounds = useMemo(() => (line ? lineBounds(line.geometry.coordinates) : null), [line]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    const confirmed = await confirmAction({
      title: 'Tour löschen?',
      message: 'Die Tour und ihre Linie werden endgültig gelöscht. Deine Abzeichen bleiben.',
      confirmText: 'Löschen',
      destructive: true,
    });
    if (!confirmed) return;
    if (await deleteRecording(id)) {
      showSuccessToast('Tour gelöscht.');
      router.back();
    }
  }, [id, deleteRecording, router]);

  const header = <Stack.Screen options={{ headerShown: true, title: 'Tour' }} />;

  const busy = isLoading || (isError && isRefetching);
  if (busy || isError || !data) {
    return (
      <View style={styles.center}>
        {header}
        {busy ? (
          <ActivityIndicator size="large" color={Colors.primary} />
        ) : (
          <Text style={styles.message}>
            {isError ? 'Die Tour konnte nicht geladen werden.' : 'Diese Tour gibt es nicht mehr.'}
          </Text>
        )}
        {isError && !busy && (
          <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button">
            <Text style={styles.retryButtonText}>Nochmal versuchen</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const values: [string, string][] = [
    ['Distanz', orDash(data.distance_m, formatDistance)],
    ['Aufstieg', orDash(data.elevation_gain_m, (m) => `${Math.round(m)} m`)],
    ['Abstieg', orDash(data.elevation_loss_m, (m) => `${Math.round(m)} m`)],
    ['Gesamtzeit', orDash(data.duration_seconds, formatDuration)],
    ['Gehzeit', orDash(data.moving_time_seconds, formatDuration)],
    ['Ø Tempo', orDash(data.avg_speed_kmh, (v) => `${v.toFixed(1)} km/h`)],
    ['Schritte', orDash(data.steps, (s) => s.toLocaleString('de-CH'))],
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {header}
      <View style={styles.mapContainer}>
        {!line ? (
          <View style={styles.center}>
            <Ionicons name="map-outline" size={40} color={Colors.textLight} />
            <Text style={styles.mapPlaceholderText}>Für diese Tour gibt es keine Linie.</Text>
          </View>
        ) : Platform.OS === 'web' || !mapLibreAvailable ? (
          <TrailMap style={styles.map} routeGeoJSON={line} />
        ) : (
          <MapView style={styles.map} mapStyle={SWISSTOPO_STYLE_JSON} logoEnabled={false} attributionEnabled={false} rotateEnabled={false} pitchEnabled={false}>
            <Camera
              defaultSettings={{ centerCoordinate: [8.2275, 46.8182], zoomLevel: 8 }}
              bounds={bounds ? { ...bounds, paddingLeft: 40, paddingRight: 40, paddingTop: 40, paddingBottom: 40 } : undefined}
            />
            <ShapeSource id="detail-track" shape={line}>
              <LineLayer id="detail-line" style={{ lineColor: '#FF6B35', lineWidth: 4, lineCap: 'round', lineJoin: 'round' }} />
            </ShapeSource>
          </MapView>
        )}
      </View>

      <Text style={styles.title}>{data.title || 'Unbenannte Tour'}</Text>
      <Text style={styles.date}>
        {orDash(data.started_at, (d) =>
          new Date(d).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' }),
        )}
      </Text>
      {data.is_hidden && <Text style={styles.hiddenNote}>Versteckt: Andere sehen diese Tour nicht.</Text>}

      <View style={styles.card}>
        {values.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.deleteButton, (pressed || isDeleting) && styles.pressed]}
        onPress={handleDelete}
        disabled={isDeleting}
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={18} color={Colors.error} />
        <Text style={styles.deleteButtonText}>Tour löschen</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, backgroundColor: Colors.background },
  message: { fontSize: 17, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  retryButton: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.primary },
  retryButtonText: { fontSize: 15, fontWeight: '600', color: Colors.textOnPrimary },
  mapContainer: { height: 260, backgroundColor: Colors.surfaceVariant },
  map: { flex: 1 },
  mapPlaceholderText: { fontSize: 14, color: Colors.textLight, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, marginTop: 16, marginHorizontal: 16 },
  date: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginHorizontal: 16 },
  hiddenNote: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, marginHorizontal: 16 },
  card: { margin: 16, padding: 16, borderRadius: 14, backgroundColor: Colors.surface, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 15, color: Colors.textSecondary },
  rowValue: { fontSize: 15, fontWeight: '600', color: Colors.text },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.surface },
  deleteButtonText: { fontSize: 16, fontWeight: '600', color: Colors.error },
  pressed: { opacity: 0.6 },
});
