import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { TrailMap } from '../../components/map/TrailMap';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { useLiveTrackingByToken } from '../../hooks/useLiveTracking';
import { showErrorToast } from '../../lib/toast';

function formatAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'Zuletzt aktualisiert gerade eben';
  if (minutes < 60) return `Zuletzt aktualisiert vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  return `Zuletzt aktualisiert vor ${hours} Std. ${minutes % 60} Min.`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapAppUrl(latitude: number, longitude: number, name: string): string {
  if (Platform.OS === 'web') {
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
  }
  if (Platform.OS === 'ios') {
    // iOS kennt kein geo:, Apple Karten öffnet denselben Punkt
    return `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(name)}`;
  }
  return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(name)})`;
}

export default function TrackScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data, isLoading, isError, refetch, isRefetching } = useLiveTrackingByToken(token);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Neuer Punkt nur bei neuem Standort, damit die Karte nicht bei jedem
  // Neuzeichnen (alle 30 s) wieder hinfliegt. Vor den frühen return (Hook-Regeln).
  const lng = data?.last_location?.longitude;
  const lat = data?.last_location?.latitude;
  const personPoint = useMemo<[number, number] | null>(
    () => (lng != null && lat != null ? [lng, lat] : null),
    [lng, lat],
  );

  const header = <Stack.Screen options={{ headerShown: true, title: '📍 Live-Standort' }} />;

  if (isLoading) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="cloud-offline-outline"
          title="Standort konnte nicht geladen werden"
          subtitle="Prüfe die Internetverbindung und versuche es erneut."
          action={
            <Pressable style={styles.button} onPress={() => refetch()} disabled={isRefetching}>
              <Text style={styles.buttonText}>Erneut versuchen</Text>
            </Pressable>
          }
        />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="link-outline"
          title="Dieser Link ist nicht mehr aktiv"
          subtitle="Die Person hat das Live-Tracking beendet oder der Link ist abgelaufen."
        />
      </View>
    );
  }

  const location = data.last_location;
  const isOverdue =
    data.is_active && !!data.expected_return && Date.parse(data.expected_return) < now;

  const openInMaps = async () => {
    if (!location) return;
    try {
      await Linking.openURL(mapAppUrl(location.latitude, location.longitude, data.display_name));
    } catch {
      showErrorToast('Karten-App konnte nicht geöffnet werden.');
    }
  };

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.personRow}>
          <Avatar uri={data.avatar_url} size={56} />
          <View style={styles.personText}>
            <Text style={styles.name}>{data.display_name}</Text>
            <Text style={styles.meta}>
              {data.last_updated_at
                ? formatAgo(data.last_updated_at, now)
                : 'Noch kein Standort gesendet'}
            </Text>
          </View>
        </View>

        {isOverdue && (
          <View style={styles.overdueCard}>
            <Ionicons name="warning" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.overdueText}>
              Überfällig – die erwartete Rückkehr ist vorbei, die Tour läuft noch.
            </Text>
          </View>
        )}

        {data.expected_return && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              Erwartete Rückkehr: {formatDateTime(data.expected_return)}
            </Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Ionicons name="flag-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.infoText}>Gestartet: {formatDateTime(data.started_at)}</Text>
        </View>

        {location ? (
          <>
            <View style={styles.mapContainer}>
              <TrailMap focusPoint={personPoint} focusZoom={14} />
            </View>
            <Pressable style={styles.button} onPress={openInMaps}>
              <Ionicons name="navigate-outline" size={18} color={Colors.textOnPrimary} />
              <Text style={styles.buttonText}>In Karten-App öffnen</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.noLocation}>
            <Ionicons name="locate-outline" size={32} color={Colors.textLight} />
            <Text style={styles.meta}>
              Der Standort erscheint, sobald die Aufzeichnung den ersten Punkt sendet.
            </Text>
          </View>
        )}

        <View style={styles.regaCard}>
          <Ionicons name="information-circle" size={20} color={Colors.info} />
          <Text style={styles.regaText}>Im Notfall: Rega 1414 oder Notruf 112 anrufen.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loader: {
    marginTop: 40,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  personText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  meta: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  overdueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.error,
    padding: 12,
    borderRadius: 12,
  },
  overdueText: {
    flex: 1,
    color: Colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 15,
    color: Colors.text,
  },
  mapContainer: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noLocation: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
    borderRadius: 16,
    backgroundColor: Colors.surfaceVariant,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  regaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceVariant,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  regaText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
