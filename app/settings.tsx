import { View, Text, Pressable, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Colors } from '../constants';
import { confirmAction } from '../lib/dialog';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const email = useAuthStore((s) => s.session?.user?.email);
  const clear = useAuthStore((s) => s.clear);

  const handleSignOut = async () => {
    const ok = await confirmAction({
      title: 'Abmelden',
      message: 'Möchtest du dich wirklich abmelden?',
      confirmText: 'Abmelden',
      destructive: true,
    });
    if (!ok) return;
    await supabase.auth.signOut();
    clear();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profil */}
        <SettingsItem
          icon="person-outline"
          label="Profil bearbeiten"
          onPress={() => router.push('/edit-profile')}
        />

        {/* Premium */}
        <SettingsItem
          icon="star-outline"
          label="Premium"
          subtitle={profile?.is_premium ? 'Aktiv' : 'Upgrade verfügbar'}
          onPress={() => router.push('/premium')}
        />

        {/* Notifications */}
        <SettingsItem
          icon="notifications-outline"
          label="Benachrichtigungen"
          onPress={() => router.push('/notification-settings')}
        />

        {/* Privacy */}
        <SettingsItem
          icon="lock-closed-outline"
          label="Privatsphäre"
          subtitle={profile?.is_private ? 'Privates Profil' : 'Öffentliches Profil'}
          onPress={() => router.push('/edit-profile')}
        />

        {/* Offline maps */}
        <SettingsItem
          icon="cloud-download-outline"
          label="Offline-Karten"
          onPress={() => router.push('/offline-maps')}
        />

        {/* Blocked users */}
        <SettingsItem
          icon="ban-outline"
          label="Blockierte Nutzer"
          onPress={() => router.push('/blocked-users')}
        />

        {/* Data protection */}
        <SettingsItem
          icon="shield-checkmark-outline"
          label="Datenschutz"
          onPress={() => router.push('/privacy')}
        />

        {/* Account */}
        <View style={styles.item}>
          <Ionicons name="mail-outline" size={22} color={Colors.text} style={styles.itemIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemLabel}>Konto</Text>
            <Text style={styles.itemSubtitle}>{email}</Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.item}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.text} style={styles.itemIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemLabel}>Über TrailMate</Text>
            <Text style={styles.itemSubtitle}>Version {APP_VERSION}</Text>
          </View>
        </View>

        {/* Sign Out */}
        <Pressable onPress={handleSignOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          <Text style={styles.signOutText}>Abmelden</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsItem({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={Colors.text} style={styles.itemIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{label}</Text>
        {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemIcon: {
    marginRight: 14,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  itemSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: 8,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
});
