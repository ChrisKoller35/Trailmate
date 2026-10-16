import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants';
import { useEvents } from '../hooks/useEvents';
import type { GroupEvent } from '../types';

export default function EventsScreen() {
  const router = useRouter();
  const { upcomingEvents, respondToEvent, getEventResponses } = useEvents();
  const [loading, setLoading] = useState(true);
  const [eventResponses, setEventResponses] = useState<Record<string, any[]>>({});

  useEffect(() => {
    // Events are loaded on mount by the hook
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Load responses when events change
  useEffect(() => {
    if (!upcomingEvents.length) return;
    upcomingEvents.forEach(async (event) => {
      if (!eventResponses[event.id]) {
        const responses = await getEventResponses(event.id);
        setEventResponses((prev) => ({ ...prev, [event.id]: responses }));
      }
    });
  }, [upcomingEvents, getEventResponses]);

  const handleRSVP = async (eventId: string, response: 'attending' | 'declined' | 'maybe') => {
    await respondToEvent(eventId, response);
    const responses = await getEventResponses(eventId);
    setEventResponses((prev) => ({ ...prev, [eventId]: responses }));
  };

  const renderEvent = ({ item }: { item: GroupEvent }) => {
    const date = new Date(item.event_date);
    const responses = eventResponses[item.id] || [];
    const attending = responses.filter((r: any) => r.response === 'attending').length;
    const maybe = responses.filter((r: any) => r.response === 'maybe').length;

    return (
      <View style={styles.eventCard}>
        {/* Date Badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.dateDay}>{date.getDate()}</Text>
          <Text style={styles.dateMonth}>
            {date.toLocaleDateString('de-CH', { month: 'short' }).toUpperCase()}
          </Text>
        </View>

        {/* Event Details */}
        <View style={styles.eventDetails}>
          <Text style={styles.eventTitle}>{item.title}</Text>

          <View style={styles.eventMetaRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.eventMeta}>
              {date.toLocaleDateString('de-CH', {
                weekday: 'short',
                day: '2-digit',
                month: 'long',
              })}{' '}
              · {date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr
            </Text>
          </View>

          {item.meeting_point && (
            <View style={styles.eventMetaRow}>
              <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.eventMeta}>{item.meeting_point}</Text>
            </View>
          )}

          {item.description && (
            <Text style={styles.eventDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Response Counts */}
          <View style={styles.responseCounts}>
            {attending > 0 && (
              <Text style={styles.responseText}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} /> {attending}
              </Text>
            )}
            {maybe > 0 && (
              <Text style={styles.responseText}>
                <Ionicons name="help-circle" size={12} color={Colors.warning} /> {maybe}
              </Text>
            )}
          </View>

          {/* RSVP Buttons */}
          <View style={styles.rsvpRow}>
            <Pressable
              style={[styles.rsvpButton, styles.rsvpAttend]}
              onPress={() => handleRSVP(item.id, 'attending')}
            >
              <Ionicons name="checkmark" size={14} color={Colors.textOnPrimary} />
              <Text style={styles.rsvpAttendText}>Zusagen</Text>
            </Pressable>
            <Pressable
              style={[styles.rsvpButton, styles.rsvpMaybe]}
              onPress={() => handleRSVP(item.id, 'maybe')}
            >
              <Text style={styles.rsvpText}>Vielleicht</Text>
            </Pressable>
            <Pressable
              style={[styles.rsvpButton, styles.rsvpDecline]}
              onPress={() => handleRSVP(item.id, 'declined')}
            >
              <Text style={styles.rsvpText}>Absagen</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Events</Text>
        <Pressable onPress={() => router.push('/create-event')} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={upcomingEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>Keine Events</Text>
              <Text style={styles.emptySubtext}>
                Tritt Gruppen und Communities bei, um Events zu sehen
              </Text>
            </View>
          }
          contentContainerStyle={
            upcomingEvents.length === 0 ? { flex: 1 } : { paddingBottom: 32 }
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
  },
  eventCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  dateBadge: {
    width: 52,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  eventMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  eventDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  responseCounts: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  responseText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  rsvpRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  rsvpAttend: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rsvpMaybe: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
  rsvpDecline: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
  rsvpAttendText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
  rsvpText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
  },
});
