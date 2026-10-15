import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { setSession, setUser, setProfile } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Bitte fülle alle Felder aus.');
      return;
    }
    setError('');
    setLoading(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
    }
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
          <View style={styles.header}>
            <Text style={styles.logo}>⛰️</Text>
            <Text style={styles.title}>TrailMate</Text>
            <Text style={styles.subtitle}>Willkommen zurück</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="E-Mail"
            placeholder="name@beispiel.ch"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Passwort"
            placeholder="Dein Passwort"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotContainer}
          >
            <Text style={styles.forgotText}>Passwort vergessen?</Text>
          </Pressable>

          <Button
            title="Anmelden"
            onPress={handleLogin}
            loading={loading}
          />

          <Pressable
            onPress={() => router.push('/(auth)/register')}
            style={styles.linkContainer}
          >
            <Text style={styles.link}>Noch kein Konto? Registrieren</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              const fakeUser = {
                id: 'dev-admin-001',
                username: 'admin',
                display_name: 'Admin (Dev)',
                email: 'admin@trailmate.dev',
                avatar_url: null,
                cover_image_url: null,
                bio: 'Dev-Modus Vorschau',
                home_region: 'Berner Oberland',
                hiking_level: 'T3' as const,
                is_premium: true,
                is_private: false,
                is_verified: true,
                notification_prefs: {},
                push_token: null,
                created_at: new Date().toISOString(),
              };
              const fakeSession = {
                access_token: 'dev-token',
                refresh_token: 'dev-refresh',
                expires_at: Date.now() + 86400000,
                user: fakeUser,
              };
              setSession(fakeSession as any);
              setUser(fakeUser as any);
              setProfile(fakeUser);
            }}
            style={styles.devContainer}
          >
            <Text style={styles.devText}>{String.fromCodePoint(0x1F527)} Dev-Vorschau (ohne Login)</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  linkContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  link: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  devContainer: {
    marginTop: 40,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  devText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
});
