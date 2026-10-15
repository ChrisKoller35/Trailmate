import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants';
import { showErrorToast } from '../lib/toast';
import { useEvents } from '../hooks/useEvents';
import { useGroups } from '../hooks/useGroups';
import { useCommunities } from '../hooks/useCommunities';
import Button from '../components/ui/Button';

export default function CreateEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ groupId?: string; communityId?: string }>();
  const { createEvent } = useEvents();
  const { myGroups } = useGroups();
  const { myCommunities } = useCommunities();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(params.groupId ?? null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    params.communityId ?? null,
  );
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      showErrorToast('Bitte gib einen Titel ein.');
      return;
    }
    if (!dateStr.trim()) {
      showErrorToast('Bitte gib ein Datum ein (DD.MM.YYYY).');
      return;
    }

    // Parse date (DD.MM.YYYY)
    const dateParts = dateStr.trim().split('.');
    if (dateParts.length !== 3) {
      showErrorToast('Datumsformat: TT.MM.JJJJ');
      return;
    }

    const [day, month, year] = dateParts.map(Number);
    const timeParts = timeStr.trim().split(':');
    const hours = timeParts.length === 2 ? Number(timeParts[0]) : 9;
    const minutes = timeParts.length === 2 ? Number(timeParts[1]) : 0;

    const eventDate = new Date(year, month - 1, day, hours, minutes);
    if (isNaN(eventDate.getTime())) {
      showErrorToast('Ungültiges Datum oder Uhrzeit.');
      return;
    }

    setLoading(true);
    const event = await createEvent({
      groupId: selectedGroupId ?? undefined,
      communityId: selectedCommunityId ?? undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      date: eventDate.toISOString(),
      meetingPoint: meetingPoint.trim() || undefined,
    });
    setLoading(false);

    if (event) {
      router.back();
    } else {
      showErrorToast('Event konnte nicht erstellt werden.');
    }
  };

  const allMemberships = [
    ...myGroups.map((g) => ({ id: g.id, name: g.name, type: 'group' as const })),
    ...myCommunities.map((c) => ({ id: c.id, name: c.name, type: 'community' as const })),
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Event erstellen</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <Text style={styles.label}>Titel *</Text>
        <TextInput
          style={styles.input}
          placeholder="z.B. Wanderung zum Oeschinensee"
          placeholderTextColor={Colors.textLight}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* Description */}
        <Text style={styles.label}>Beschreibung</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Details zum Event..."
          placeholderTextColor={Colors.textLight}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={500}
          textAlignVertical="top"
        />

        {/* Date */}
        <Text style={styles.label}>Datum *</Text>
        <TextInput
          style={styles.input}
          placeholder="TT.MM.JJJJ"
          placeholderTextColor={Colors.textLight}
          value={dateStr}
          onChangeText={setDateStr}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        {/* Time */}
        <Text style={styles.label}>Uhrzeit</Text>
        <TextInput
          style={styles.input}
          placeholder="HH:MM (z.B. 09:00)"
          placeholderTextColor={Colors.textLight}
          value={timeStr}
          onChangeText={setTimeStr}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />

        {/* Meeting Point */}
        <Text style={styles.label}>Treffpunkt</Text>
        <TextInput
          style={styles.input}
          placeholder="z.B. Bahnhof Kandersteg"
          placeholderTextColor={Colors.textLight}
          value={meetingPoint}
          onChangeText={setMeetingPoint}
          maxLength={200}
        />

        {/* Group/Community Selector */}
        {!params.groupId && !params.communityId && allMemberships.length > 0 && (
          <>
            <Text style={styles.label}>Gruppe / Community</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {allMemberships.map((m) => {
                const isSelected =
                  (m.type === 'group' && selectedGroupId === m.id) ||
                  (m.type === 'community' && selectedCommunityId === m.id);

                return (
                  <Pressable
                    key={m.id}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => {
                      if (m.type === 'group') {
                        setSelectedGroupId(isSelected ? null : m.id);
                        setSelectedCommunityId(null);
                      } else {
                        setSelectedCommunityId(isSelected ? null : m.id);
                        setSelectedGroupId(null);
                      }
                    }}
                  >
                    <Ionicons
                      name={m.type === 'group' ? 'people' : 'earth'}
                      size={14}
                      color={isSelected ? Colors.textOnPrimary : Colors.textSecondary}
                    />
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {m.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Create Button */}
        <View style={styles.buttonContainer}>
          <Button
            title="Event erstellen"
            onPress={handleCreate}
            loading={loading}
            disabled={!title.trim() || !dateStr.trim()}
          />
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  textArea: {
    minHeight: 80,
  },
  chips: {
    flexDirection: 'row',
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceVariant,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.textOnPrimary,
  },
  buttonContainer: {
    marginTop: 32,
    marginBottom: 40,
  },
});
