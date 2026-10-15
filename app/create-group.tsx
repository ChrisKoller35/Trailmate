import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  Pressable,
  Switch,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants';
import { showErrorToast } from '../lib/toast';
import { useGroups } from '../hooks/useGroups';
import Button from '../components/ui/Button';

export default function CreateGroupScreen() {
  const router = useRouter();
  const { createGroup } = useGroups();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showErrorToast('Bitte gib einen Gruppennamen ein.');
      return;
    }

    setLoading(true);
    const group = await createGroup(trimmedName, description.trim(), isPrivate);
    setLoading(false);

    if (group) {
      router.back();
      router.push(`/group-detail?id=${group.id}`);
    } else {
      showErrorToast('Gruppe konnte nicht erstellt werden.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gruppe erstellen</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Cover Image Placeholder */}
        <Pressable style={styles.coverPicker}>
          <Ionicons name="camera-outline" size={32} color={Colors.textLight} />
          <Text style={styles.coverPickerText}>Titelbild hinzufügen</Text>
        </Pressable>

        {/* Name */}
        <Text style={styles.label}>Gruppenname *</Text>
        <TextInput
          style={styles.input}
          placeholder="z.B. Wanderfreunde Bern"
          placeholderTextColor={Colors.textLight}
          value={name}
          onChangeText={setName}
          maxLength={60}
        />

        {/* Description */}
        <Text style={styles.label}>Beschreibung</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Worum geht es in eurer Gruppe?"
          placeholderTextColor={Colors.textLight}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
        />

        {/* Privacy Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Private Gruppe</Text>
            <Text style={styles.toggleHint}>
              {isPrivate
                ? 'Nur eingeladene Mitglieder können beitreten'
                : 'Jeder kann der Gruppe beitreten'}
            </Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={isPrivate ? Colors.primary : Colors.surface}
          />
        </View>

        {/* Create Button */}
        <View style={styles.buttonContainer}>
          <Button
            title="Gruppe erstellen"
            onPress={handleCreate}
            loading={loading}
            disabled={!name.trim()}
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
  coverPicker: {
    height: 140,
    borderRadius: 12,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  coverPickerText: {
    fontSize: 13,
    color: Colors.textLight,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 8,
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
    marginBottom: 8,
  },
  textArea: {
    minHeight: 100,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  toggleHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  buttonContainer: {
    marginTop: 32,
    marginBottom: 40,
  },
});
