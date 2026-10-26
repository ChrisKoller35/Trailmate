import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, REGIONS } from '../../constants';
import { showErrorToast } from '../../lib/toast';
import { detectHomeRegion } from '../../lib/detectHomeRegion';
import { usePermissions } from '../../hooks/usePermissions';
import Button from '../../components/ui/Button';
import ProgressIndicator from '../../components/onboarding/ProgressIndicator';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/storage';

export default function HomeRegionScreen() {
  const router = useRouter();
  const { homeRegion, setHomeRegion, setCurrentStep, displayName, username, avatarUri, hikingLevel, completeOnboarding } = useOnboardingStore();
  const { session } = useAuthStore();
  const { requestLocationPermission } = usePermissions();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCurrentStep(4);
  }, [setCurrentStep]);

  const detectLocation = async () => {
    const granted = await requestLocationPermission();
    if (!granted) return;
    const region = await detectHomeRegion({ requestPermission: false });
    if (region) {
      setHomeRegion(region);
    } else {
      showErrorToast('Keine Wanderregion in deiner Nähe gefunden. Bitte wähle eine aus der Liste.');
    }
  };

  const finish = async () => {
    if (!session?.user?.id) {
      completeOnboarding();
      router.replace('/(tabs)/explore');
      return;
    }
    setIsSaving(true);
    // Ohne Auswahl einmal über den Standort schätzen, damit Schritt 5 passende Vorschläge zeigt.
    // detectHomeRegion wirft nicht; ohne Freigabe bleibt die Region leer.
    let region = homeRegion;
    if (!region) {
      region = await detectHomeRegion({ requestPermission: true });
      setHomeRegion(region);
    }
    try {
      // Upload avatar if selected
      let finalAvatarUrl: string | null = null;
      if (avatarUri) {
        const ext = avatarUri.split('.').pop() || 'jpg';
        const result = await uploadAvatar(session.user.id, {
          uri: avatarUri,
          name: `avatar.${ext}`,
          type: `image/${ext}`,
        });
        finalAvatarUrl = result.publicUrl;
      }

      // Upsert profile – works whether row exists or not.
      // setProfile erst in Schritt 5, sonst springt app/_layout.tsx sofort zu den Tabs.
      const { error: saveError } = await supabase
        .from('users')
        .upsert({
          id: session.user.id,
          display_name: displayName,
          username,
          avatar_url: finalAvatarUrl,
          hiking_level: hikingLevel,
          home_region: region,
        }, { onConflict: 'id' });

      if (saveError) throw saveError;
    } catch (err) {
      console.error('Onboarding save error:', err);
      // Supabase-Fehler sind nicht immer Error-Instanzen, haben aber eine message.
      const { code, message } = (err ?? {}) as { code?: string; message?: string };
      // Name zwischen Prüfung in Schritt 2 und Speichern vergeben: dorthin zurück.
      if (code === '23505' && message?.includes('username')) {
        showErrorToast('Dieser Benutzername ist inzwischen vergeben.');
        router.replace('/(onboarding)/profile-basics');
        return;
      }
      showErrorToast(message ?? 'Profil konnte nicht gespeichert werden. Du kannst es später in den Einstellungen nachtragen.');
    } finally {
      setIsSaving(false);
    }
    // Auch nach einem Speicherfehler weiter, damit niemand im Onboarding hängen bleibt.
    router.push('/(onboarding)/follow-suggestions');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressIndicator step={4} total={5} />
        <Text style={styles.title}>Wo wanderst du am liebsten?</Text>

        <Pressable style={styles.detectButton} onPress={detectLocation}>
          <Ionicons name="location-outline" size={20} color={Colors.primary} />
          <Text style={styles.detectText}>📍 Automatisch erkennen</Text>
        </Pressable>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {REGIONS.map((region) => (
            <Pressable
              key={region}
              style={[
                styles.regionItem,
                homeRegion === region && styles.regionSelected,
              ]}
              onPress={() => setHomeRegion(region)}
            >
              <Text
                style={[
                  styles.regionText,
                  homeRegion === region && styles.regionTextSelected,
                ]}
              >
                {region}
              </Text>
              {homeRegion === region && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={Colors.primary}
                />
              )}
            </Pressable>
          ))}
        </ScrollView>

        {!homeRegion && (
          <Text style={styles.skipHint}>
            Ohne Auswahl schätzen wir die Region einmal über deinen Standort.
          </Text>
        )}
        <Button
          title={isSaving ? 'Wird gespeichert…' : homeRegion ? 'Weiter' : 'Später wählen'}
          onPress={finish}
          disabled={isSaving}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 20,
  },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceVariant,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  detectText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  list: {
    flex: 1,
    marginBottom: 16,
  },
  listContent: {
    gap: 8,
  },
  regionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  regionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceVariant,
  },
  regionText: {
    fontSize: 16,
    color: Colors.text,
  },
  regionTextSelected: {
    fontWeight: '700',
    color: Colors.primary,
  },
  skipHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
});
