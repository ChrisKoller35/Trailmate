import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../constants';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { parseRecoveryUrl, passwordProblem, passwordUpdateErrorMessage } from '../lib/authRecovery';
import { showSuccessToast } from '../lib/toast';

type Phase = { kind: 'loading' } | { kind: 'form' } | { kind: 'error'; message: string };

const NO_LINK_MESSAGE = 'Öffne den Link aus der E-Mail, um ein neues Passwort zu setzen.';
const INVALID_MESSAGE = 'Der Link ist ungültig. Fordere einen neuen an.';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const link = useMemo(() => parseRecoveryUrl(url), [url]);
  const handledUrl = useRef<string | null>(null);
  const [session, setSession] = useState<{ url: string; ok: boolean } | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Jeden Link nur einmal verarbeiten, auch wenn der Screen neu rendert
    if (url === null || link.kind !== 'tokens' || handledUrl.current === url) return;
    handledUrl.current = url;
    supabase.auth
      .setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
      .then(({ error: sessionError }) => {
        // Die Schlüssel sollen nicht im Browserverlauf bleiben
        if (!sessionError && Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        setSession({ url, ok: !sessionError });
      })
      .catch(() => setSession({ url, ok: false }));
  }, [url, link]);

  let phase: Phase;
  if (url === null) phase = { kind: 'loading' };
  else if (link.kind === 'none') phase = { kind: 'error', message: NO_LINK_MESSAGE };
  else if (link.kind === 'error') phase = { kind: 'error', message: link.message };
  else if (session?.url !== url) phase = { kind: 'loading' };
  else phase = session.ok ? { kind: 'form' } : { kind: 'error', message: INVALID_MESSAGE };

  const handleSave = async () => {
    const problem = passwordProblem(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(passwordUpdateErrorMessage(updateError));
      return;
    }
    showSuccessToast('Passwort geändert.');
    router.replace('/(tabs)');
  };

  const header = <Stack.Screen options={{ headerShown: true, title: 'Neues Passwort' }} />;

  if (phase.kind === 'loading') {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (phase.kind === 'error') {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.message}>{phase.message}</Text>
        <Button title="Neuen Link anfordern" onPress={() => router.replace('/(auth)/forgot-password')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {header}
      <View style={styles.container}>
        <Input
          label="Neues Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <Input
          label="Passwort bestätigen"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
        />
        <Button title="Passwort speichern" onPress={handleSave} loading={saving} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  error: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
});
