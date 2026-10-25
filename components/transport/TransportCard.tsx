import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { usePublicTransport } from '../../hooks/usePublicTransport';
import {
  addDays,
  formatDuration,
  formatTime,
  formatTravelDateLabel,
} from '../../lib/publicTransport';
import type { TransportConnection } from '../../lib/publicTransport';

// ─── Props ─────────────────────────────────────────────────

interface TransportCardProps {
  routeId: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  routeDurationMin?: number;
}

// ─── Component ─────────────────────────────────────────────

export default function TransportCard({
  routeId,
  startLat,
  startLng,
  endLat,
  endLng,
  routeDurationMin,
}: TransportCardProps) {
  const {
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
  } = usePublicTransport(routeId, startLat, startLng, endLat, endLng, routeDurationMin);

  const [activeTab, setActiveTab] = useState<'outbound' | 'return'>('outbound');

  const openSBBLink = () => {
    if (sbbLink) {
      Linking.openURL(sbbLink);
    }
  };

  const shiftDate = (days: number) => {
    setSelectedDate(addDays(selectedDate, days));
  };

  // Time adjustment
  const shiftTime = (minutesDelta: number) => {
    const [h, m] = selectedTime.split(':').map(Number);
    let totalMin = h * 60 + m + minutesDelta;
    if (totalMin < 0) totalMin = 0;
    if (totalMin > 1439) totalMin = 1439;
    const newH = Math.floor(totalMin / 60)
      .toString()
      .padStart(2, '0');
    const newM = (totalMin % 60).toString().padStart(2, '0');
    setSelectedTime(`${newH}:${newM}`);
  };

  if (!startLat || !startLng) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚂 ÖV-Anreise</Text>
        <TouchableOpacity onPress={refreshConnections} disabled={isLoading}>
          <Ionicons
            name="refresh"
            size={20}
            color={isLoading ? Colors.textSecondary : Colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Stations */}
      {startStation && (
        <View style={styles.stationRow}>
          <View style={styles.stationDot} />
          <View style={styles.stationInfo}>
            <Text style={styles.stationLabel}>Nächste Haltestelle (Start)</Text>
            <Text style={styles.stationName}>{startStation.name}</Text>
            {startStation.distance !== undefined && (
              <Text style={styles.stationDistance}>
                {startStation.distance < 1000
                  ? `${Math.round(startStation.distance)} m entfernt`
                  : `${(startStation.distance / 1000).toFixed(1)} km entfernt`}
              </Text>
            )}
          </View>
        </View>
      )}
      {endStation && endStation.name !== startStation?.name && (
        <View style={styles.stationRow}>
          <View style={[styles.stationDot, styles.stationDotEnd]} />
          <View style={styles.stationInfo}>
            <Text style={styles.stationLabel}>Nächste Haltestelle (Ziel)</Text>
            <Text style={styles.stationName}>{endStation.name}</Text>
          </View>
        </View>
      )}

      {/* Date/Time selector */}
      <View style={styles.dateTimeRow}>
        <View style={styles.dateSelector}>
          <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.arrowButton}>
            <Ionicons name="chevron-back" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatTravelDateLabel(selectedDate)}</Text>
          <TouchableOpacity onPress={() => shiftDate(1)} style={styles.arrowButton}>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.timeSelector}>
          <TouchableOpacity onPress={() => shiftTime(-30)} style={styles.arrowButton}>
            <Ionicons name="chevron-back" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.timeText}>{selectedTime}</Text>
          <TouchableOpacity onPress={() => shiftTime(30)} style={styles.arrowButton}>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'outbound' && styles.tabActive]}
          onPress={() => setActiveTab('outbound')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'outbound' && styles.tabTextActive,
            ]}
          >
            Hinfahrt
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'return' && styles.tabActive]}
          onPress={() => setActiveTab('return')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'return' && styles.tabTextActive,
            ]}
          >
            Rückfahrt
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Verbindungen suchen…</Text>
        </View>
      )}

      {/* Error */}
      {error && !isLoading && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={refreshConnections}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.retryButtonText}>Nochmal versuchen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connections list */}
      {!isLoading && !error && (
        <ConnectionsList
          connections={
            activeTab === 'outbound' ? outboundConnections : returnConnections
          }
        />
      )}

      {/* Offline note */}
      <View style={styles.noteRow}>
        <Ionicons name="cloud-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.noteText}>Nur mit Internetverbindung</Text>
      </View>

      {/* SBB ticket link */}
      {sbbLink && (
        <TouchableOpacity
          style={styles.sbbButton}
          onPress={openSBBLink}
          activeOpacity={0.7}
        >
          <Text style={styles.sbbButtonText}>SBB Ticket kaufen →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Connections List ──────────────────────────────────────

function ConnectionsList({
  connections,
}: {
  connections: TransportConnection[];
}) {
  if (connections.length === 0) {
    return (
      <Text style={styles.emptyText}>
        Keine Verbindungen gefunden. Versuche ein anderes Datum oder eine andere
        Zeit.
      </Text>
    );
  }

  return (
    <FlatList
      data={connections}
      keyExtractor={(_, index) => `conn-${index}`}
      scrollEnabled={false}
      renderItem={({ item }) => <ConnectionItem connection={item} />}
    />
  );
}

// ─── Connection Item ───────────────────────────────────────

function ConnectionItem({ connection }: { connection: TransportConnection }) {
  const [expanded, setExpanded] = useState(false);

  // Extract transport types from sections
  const transportTypes = connection.sections
    .filter((s) => s.journey)
    .map((s) => s.journey!.name || `${s.journey!.category} ${s.journey!.number}`)
    .filter(Boolean);

  return (
    <View style={styles.connectionItem}>
      <TouchableOpacity
        style={styles.connectionMain}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.connectionTimes}>
          <Text style={styles.connectionDeparture}>
            {formatTime(connection.departure)}
          </Text>
          <View style={styles.connectionArrow}>
            <View style={styles.connectionLine} />
            <Ionicons
              name="arrow-forward"
              size={12}
              color={Colors.textSecondary}
            />
          </View>
          <Text style={styles.connectionArrival}>
            {formatTime(connection.arrival)}
          </Text>
        </View>

        <View style={styles.connectionDetails}>
          <Text style={styles.connectionDuration}>
            {formatDuration(connection.duration)}
          </Text>
          <Text style={styles.connectionTransfers}>
            {connection.transfers === 0
              ? 'Direkt'
              : `${connection.transfers}× Umsteigen`}
          </Text>
          {connection.platform && (
            <Text style={styles.connectionPlatform}>
              Gl. {connection.platform}
            </Text>
          )}
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {/* Transport types */}
      {transportTypes.length > 0 && (
        <View style={styles.transportTypes}>
          {transportTypes.map((name, i) => (
            <View key={`${name}-${i}`} style={styles.transportBadge}>
              <Text style={styles.transportBadgeText}>{name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Expanded sections */}
      {expanded && (
        <View style={styles.sectionsContainer}>
          {connection.sections.map((section, i) => (
            <View key={`section-${i}`} style={styles.sectionItem}>
              {section.journey ? (
                <>
                  <View style={styles.sectionDot} />
                  <View style={styles.sectionContent}>
                    <Text style={styles.sectionTransport}>
                      {section.journey.name ||
                        `${section.journey.category} ${section.journey.number}`}
                    </Text>
                    <Text style={styles.sectionStation}>
                      {formatTime(section.departure.departure)}{' '}
                      {section.departure.station}
                      {section.departure.platform
                        ? ` (Gl. ${section.departure.platform})`
                        : ''}
                    </Text>
                    <Text style={styles.sectionStation}>
                      {formatTime(section.arrival.arrival)}{' '}
                      {section.arrival.station}
                    </Text>
                  </View>
                </>
              ) : section.walk !== undefined ? (
                <>
                  <Ionicons
                    name="walk"
                    size={14}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.sectionWalk}>
                    Fussweg{' '}
                    {section.walk < 60
                      ? `${section.walk}s`
                      : `${Math.ceil(section.walk / 60)} Min.`}
                  </Text>
                </>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
    paddingLeft: 4,
  },
  stationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  stationDotEnd: {
    backgroundColor: Colors.accent,
  },
  stationInfo: {
    flex: 1,
  },
  stationLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 1,
  },
  stationName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  stationDistance: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  dateSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
    minWidth: 120,
  },
  arrowButton: {
    padding: 4,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 10,
    padding: 2,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  connectionItem: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  connectionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectionTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectionDeparture: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  connectionArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  connectionLine: {
    width: 16,
    height: 1,
    backgroundColor: Colors.textSecondary,
  },
  connectionArrival: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  connectionDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  connectionDuration: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  connectionTransfers: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  connectionPlatform: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  transportTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  transportBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  transportBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  sectionsContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    gap: 8,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTransport: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  sectionStation: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  sectionWalk: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    justifyContent: 'center',
  },
  noteText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  sbbButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  sbbButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
