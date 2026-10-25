import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ProgressIndicator from '../../components/onboarding/ProgressIndicator';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuth } from '../../hooks/useAuth';
import { normalizeUsername, suggestUsername, validateUsername } from '../../lib/username';

export default function ProfileBasicsScreen() {
  const router = useRouter();
  const {
    displayName,
    username,
    avatarUri,
    setDisplayName,
    setUsername,
    setAvatarUri,
    setCurrentStep,
  } = useOnboardingStore();

  const [displayNameError, setDisplayNameError] = useState('');

  useEffect(() => {
    setCurrentStep(2);
  }, [setCurrentStep]);

  // Wer schon einen Namen hat (z. B. zurück aus Schritt 4), behält ihn.
  const [usernameEdited, setUsernameEdited] = useState(() => username !== '');
  // Zuletzt geprüfter Name und Ergebnis; weicht er ab, läuft die Prüfung noch.
  const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(null);

  // useAuth liefert pro Render eine neue Funktion; checkUsername hängt nur
  // von supabase ab, darum genügt die erste.
  const checkUsernameRef = useRef(useAuth().checkUsername);

  // Vorschlag aus dem Anzeigenamen, bis die Person das Feld selbst ändert.
  useEffect(() => {
    if (usernameEdited) return;
    setUsername(displayName.trim() ? suggestUsername(displayName) : '');
  }, [displayName, usernameEdited, setUsername]);

  const formatError = validateUsername(username);
  useEffect(() => {
    if (formatError) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const free = await checkUsernameRef.current(username);
      if (!cancelled) setChecked({ name: username, free });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, formatError]);

  const isChecking = !formatError && checked?.name !== username;
  const isTaken = !formatError && checked?.name === username && !checked.free;
  const usernameError = username
    ? formatError ?? (isTaken ? 'Benutzername bereits vergeben' : '')
    : '';

  const handleUsernameChange = (text: string) => {
    setUsernameEdited(true);
    setUsername(normalizeUsername(text));
  };

  const pickAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  }, [setAvatarUri]);

  const handleNext = () => {
    if (!displayName.trim()) {
      setDisplayNameError('Bitte gib einen Namen ein.');
      return;
    }
    setDisplayNameError('');
    if (formatError || isChecking || isTaken) return;
    router.push('/(onboarding)/hiking-level');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <ProgressIndicator step={2} total={5} />
          <Text style={styles.title}>Wie heisst du?</Text>

          {/* Avatar Picker */}
          <Pressable onPress={pickAvatar} style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons
                  name="camera-outline"
                  size={32}
                  color={Colors.textLight}
                />
              </View>
            )}
            <Text style={styles.avatarHint}>Profilbild wählen</Text>
          </Pressable>

          <Input
            label="Anzeigename"
            placeholder="Dein Name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            error={displayNameError}
          />

          <Input
            label="Benutzername"
            placeholder="dein_name"
            value={username}
            onChangeText={handleUsernameChange}
            autoCapitalize="none"
            autoCorrect={false}
            error={usernameError}
          />

          <View style={styles.buttons}>
            <Button
              title="Weiter"
              onPress={handleNext}
              loading={isChecking}
              disabled={!!usernameError}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  avatarHint: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  buttons: {
    marginTop: 16,
  },
});
