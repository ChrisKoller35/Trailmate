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
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, REGIONS } from '../../constants';
import { showErrorToast } from '../../lib/toast';
import { usePermissions } from '../../hooks/usePermissions';
import Button from '../../components/ui/Button';
import ProgressIndicator from '../../components/onboarding/ProgressIndicator';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { uploadAvatar } from '../../lib/storage';
import type { User } from '../../types';

export default function HomeRegionScreen() {
  const router = useRouter();
  const { homeRegion, setHomeRegion, setCurrentStep, displayName, username, avatarUri, hikingLevel, completeOnboarding } = useOnboardingStore();
  const { session, setProfile, setOnboardingComplete } = useAuthStore();
  const { requestLocationPermission } = usePermissions();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCurrentStep(4);
  }, []);

  const detectLocation = async () => {
    const granted = await requestLocationPermission();
    if (!granted) return;
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const [result] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (result?.region) {
        // Try to match to one of our predefined regions
        const matched = REGIONS.find((r) =>
          result.region?.toLowerCase().includes(r.split(' ')[0].toLowerCase()),
        );
        setHomeRegion(matched ?? result.region);
      }
    } catch {
      showErrorToast('Standort konnte nicht ermittelt werden.');
    }
  };

  const finish = async () => {
    if (!session?.user?.id) {
      completeOnboarding();
      router.replace('/(tabs)/explore');
      return;
    }
    setIsSaving(true);
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

      // Save profile to users table
      // Save profile to users table via upsert

      // Upsert profile – works whether row exists or not
      const { data: profile, error: saveError } = await supabase
        .from('users')
        .upsert({
          id: session.user.id,
          display_name: displayName,
          username,
          avatar_url: finalAvatarUrl,
          hiking_level: hikingLevel,
          home_region: homeRegion,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (saveError) {
        console.error('Onboarding save error:', saveError);
        throw saveError;
      }

      if (profile) {
        setProfile(profile as User);
      }

      completeOnboarding();
      setOnboardingComplete(true);
      router.replace('/(tabs)/explore');
    } catch (err: any) {
      console.error('Onboarding save error:', err);
      showErrorToast(err.message ?? 'Profil konnte nicht gespeichert werden. Du kannst es später in den Einstellungen nachtragen.');
      // Complete onboarding anyway so the user doesn't get stuck in a loop
      completeOnboarding();
      setOnboardingComplete(true);
      router.replace('/(tabs)/explore');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressIndicator step={4} total={4} />
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

        <Button
          title={isSaving ? 'Wird gespeichert…' : 'Los geht\'s'}
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
});
