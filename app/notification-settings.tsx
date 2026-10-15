import { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, ScrollView, Switch, StyleSheet } from 'react-native';
import { Colors } from '../constants';
import { showErrorToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface NotificationPrefs {
  dm: boolean;
  post_inbox: boolean;
  new_follower: boolean;
  likes: boolean;
  comments: boolean;
  new_badge: boolean;
  challenge_update: boolean;
  trail_condition: boolean;
  weather_warning: boolean;
  trusted_contact: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  dm: true,
  post_inbox: true,
  new_follower: true,
  likes: false,
  comments: false,
  new_badge: true,
  challenge_update: false,
  trail_condition: true,
  weather_warning: true,
  trusted_contact: true,
};

export default function NotificationSettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    ...DEFAULT_PREFS,
    ...(profile?.notification_prefs as Partial<NotificationPrefs>),
  });

  const updatePref = async (key: keyof NotificationPrefs, value: boolean) => {
    if (key === 'trusted_contact') return; // always on

    const updated = { ...prefs, [key]: value };
    setPrefs(updated);

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ notification_prefs: updated })
        .eq('id', profile!.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data);
    } catch {
      // Revert on error
      setPrefs(prefs);
      showErrorToast('Einstellung konnte nicht gespeichert werden.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionHeader title="💬 Nachrichten" />
        <ToggleRow label="DMs" value={prefs.dm} onChange={(v) => updatePref('dm', v)} />
        <ToggleRow label="Post-Postfach" value={prefs.post_inbox} onChange={(v) => updatePref('post_inbox', v)} />

        <SectionHeader title="👥 Soziales" />
        <ToggleRow label="Neuer Follower" value={prefs.new_follower} onChange={(v) => updatePref('new_follower', v)} />
        <ToggleRow label="Likes" value={prefs.likes} onChange={(v) => updatePref('likes', v)} />
        <ToggleRow label="Kommentare" value={prefs.comments} onChange={(v) => updatePref('comments', v)} />

        <SectionHeader title="🏆 Aktivität" />
        <ToggleRow label="Neues Abzeichen" value={prefs.new_badge} onChange={(v) => updatePref('new_badge', v)} />
        <ToggleRow label="Challenge-Update" value={prefs.challenge_update} onChange={(v) => updatePref('challenge_update', v)} />

        <SectionHeader title="🗺️ Routen" />
        <ToggleRow label="Zustandsbericht" value={prefs.trail_condition} onChange={(v) => updatePref('trail_condition', v)} />
        <ToggleRow label="Wetter-Warnung" value={prefs.weather_warning} onChange={(v) => updatePref('weather_warning', v)} />

        <SectionHeader title="🆘 Sicherheit" />
        <ToggleRow label="Vertrauensperson" value={true} onChange={() => {}} disabled hint="Kann nicht deaktiviert werden" />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function ToggleRow({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: Colors.border, true: Colors.primaryLight }}
        thumbColor={value ? Colors.primary : Colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  rowHint: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
});
