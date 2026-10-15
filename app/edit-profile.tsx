import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  Switch,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { showErrorToast } from '../lib/toast';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, REGIONS, HIKING_LEVELS, APP_CONFIG } from '../constants';
import { supabase } from '../lib/supabase';
import { uploadAvatar, uploadCoverImage } from '../lib/storage';
import { useAuthStore } from '../stores/authStore';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import type { HikingLevel } from '../types';

export default function EditProfileScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [homeRegion, setHomeRegion] = useState(profile?.home_region ?? '');
  const [hikingLevel, setHikingLevel] = useState<HikingLevel | null>(profile?.hiking_level ?? null);
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [avatarUri, setAvatarUri] = useState(profile?.avatar_url ?? null);
  const [coverUri, setCoverUri] = useState(profile?.cover_image_url ?? null);
  const [saving, setSaving] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Live username uniqueness check
  useEffect(() => {
    if (!username || username === profile?.username) {
      setUsernameError('');
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', profile?.id ?? '')
        .maybeSingle();
      setUsernameError(data ? 'Benutzername bereits vergeben' : '');
    }, 500);
    return () => clearTimeout(timer);
  }, [username, profile?.id, profile?.username]);

  const pickImage = async (type: 'avatar' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (type === 'avatar') {
      setAvatarUri(asset.uri);
    } else {
      setCoverUri(asset.uri);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    if (usernameError) return;

    setSaving(true);
    try {
      let newAvatarUrl = profile.avatar_url;
      let newCoverUrl = profile.cover_image_url;

      // Upload avatar if changed
      if (avatarUri && avatarUri !== profile.avatar_url) {
        const fileName = avatarUri.split('/').pop() ?? 'avatar.jpg';
        const { publicUrl } = await uploadAvatar(profile.id, {
          uri: avatarUri,
          name: fileName,
          type: 'image/jpeg',
        });
        newAvatarUrl = publicUrl;
      }

      // Upload cover if changed
      if (coverUri && coverUri !== profile.cover_image_url) {
        const fileName = coverUri.split('/').pop() ?? 'cover.jpg';
        const { publicUrl } = await uploadCoverImage(profile.id, {
          uri: coverUri,
          name: fileName,
          type: 'image/jpeg',
        });
        newCoverUrl = publicUrl;
      }

      const updates = {
        display_name: displayName.trim() || null,
        username: username.trim(),
        bio: bio.trim() || null,
        home_region: homeRegion || null,
        hiking_level: hikingLevel,
        is_private: isPrivate,
        avatar_url: newAvatarUrl,
        cover_image_url: newCoverUrl,
      };

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/profile');
      }
    } catch (err: any) {
      showErrorToast(err.message ?? 'Profil konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Back Button */}
          <Pressable
            style={styles.backButton}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>

          {/* Cover Image */}
          <Pressable onPress={() => pickImage('cover')} style={styles.coverContainer}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="camera-outline" size={32} color={Colors.textLight} />
                <Text style={styles.coverPlaceholderText}>Titelbild ändern</Text>
              </View>
            )}
          </Pressable>

          {/* Avatar */}
          <Pressable onPress={() => pickImage('avatar')} style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person-outline" size={32} color={Colors.textLight} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color={Colors.textOnPrimary} />
            </View>
          </Pressable>

          {/* Form Fields */}
          <View style={styles.form}>
            <Input
              label="Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Dein Anzeigename"
            />

            <Input
              label="Benutzername"
              value={username}
              onChangeText={setUsername}
              placeholder="Eindeutiger Benutzername"
              autoCapitalize="none"
              error={usernameError}
            />

            <View>
              <Text style={styles.label}>Bio</Text>
              <View style={styles.bioWrapper}>
                <Input
                  value={bio}
                  onChangeText={(text: string) => setBio(text.slice(0, APP_CONFIG.maxBioLength))}
                  placeholder="Erzähl etwas über dich…"
                  multiline
                  numberOfLines={3}
                />
              </View>
              <Text style={styles.charCounter}>{bio.length}/{APP_CONFIG.maxBioLength}</Text>
            </View>

            {/* Home Region */}
            <View>
              <Text style={styles.label}>Heimatregion</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {REGIONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setHomeRegion(homeRegion === r ? '' : r)}
                    style={[styles.chip, homeRegion === r && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, homeRegion === r && styles.chipTextSelected]}>{r}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Hiking Level */}
            <View>
              <Text style={styles.label}>Wanderniveau</Text>
              <View style={styles.levelRow}>
                {HIKING_LEVELS.map((l) => (
                  <Pressable
                    key={l.value}
                    onPress={() => setHikingLevel(hikingLevel === l.value ? null : l.value)}
                    style={[styles.levelChip, hikingLevel === l.value && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, hikingLevel === l.value && styles.chipTextSelected]}>
                      {l.emoji} {l.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Privacy */}
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Privates Profil</Text>
                <Text style={styles.switchHint}>
                  {isPrivate ? 'Nur bestätigte Follower sehen deine Inhalte' : 'Öffentlich sichtbar'}
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={isPrivate ? Colors.primary : Colors.surface}
              />
            </View>

            <View style={{ marginTop: 8 }}>
              <Button title="Speichern" onPress={handleSave} loading={saving} disabled={!!usernameError} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverContainer: {
    height: 160,
    width: '100%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 4,
  },
  avatarWrapper: {
    marginTop: -36,
    marginLeft: 16,
    width: 72,
    height: 72,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: Colors.surface,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 3,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  bioWrapper: {
    minHeight: 80,
  },
  charCounter: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: 2,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceVariant,
    marginRight: 8,
    marginBottom: 4,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.text,
  },
  chipTextSelected: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  levelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  levelChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  switchHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
