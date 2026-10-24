import { useState, useEffect, useCallback } from 'react';
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

export default function ProfileBasicsScreen() {
  const router = useRouter();
  const {
    displayName,
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

  // Auto-generate username from display name
  useEffect(() => {
    if (!displayName.trim()) return;
    const base = displayName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20);
    const suffix = Math.floor(1000 + Math.random() * 9000);
    setUsername(`${base}_${suffix}`);
  }, [displayName, setUsername]);

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

          <View style={styles.buttons}>
            <Button title="Weiter" onPress={handleNext} />
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
