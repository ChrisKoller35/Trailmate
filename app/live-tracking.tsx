import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { showErrorToast, showInfoToast } from '../lib/toast';
import { confirmAction } from '../lib/dialog';
import { Ionicons } from '@expo/vector-icons';
import { APP_CONFIG, Colors } from '../constants';
import { useLiveTracking, useStartLiveTracking, useStopLiveTracking } from '../hooks/useLiveTracking';
import { usePremium } from '../hooks/usePremium';

interface ContactInput {
  name: string;
  contact: string;
}

const DURATION_OPTIONS = [
  { label: 'Bis Tour-Ende', value: null },
  { label: '4 h', value: 4 },
  { label: '6 h', value: 6 },
  { label: '8 h', value: 8 },
  { label: '12 h', value: 12 },
] as const;

const trackingLink = (token: string) => `${APP_CONFIG.webBaseUrl}/track/${token}`;

const INTERVAL_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '30 min', value: 30 },
] as const;

export default function LiveTrackingScreen() {
  const { isPremium } = usePremium();
  const router = useRouter();
  const { data: activeSession, isLoading } = useLiveTracking();
  const startTracking = useStartLiveTracking();
  const stopTracking = useStopLiveTracking();

  const [contacts, setContacts] = useState<ContactInput[]>([{ name: '', contact: '' }]);
  const [duration, setDuration] = useState<number | null>(null);
  const [interval, setInterval] = useState(10);
  const [expectedReturn, setExpectedReturn] = useState('');

  const addContact = () => {
    if (contacts.length >= 3) return;
    setContacts([...contacts, { name: '', contact: '' }]);
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: keyof ContactInput, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const handleStart = () => {
    const validContacts = contacts.filter((c) => c.name.trim());
    if (validContacts.length === 0) {
      showErrorToast('Bitte mindestens eine Vertrauensperson angeben.');
      return;
    }

    const trusted = validContacts.map((c) => {
      const isEmail = c.contact.includes('@');
      return {
        name: c.name.trim(),
        ...(isEmail ? { email: c.contact.trim() } : { phone: c.contact.trim() }),
      };
    });

    let expected_return: string | null = null;
    if (expectedReturn.trim()) {
      expected_return = expectedReturn.trim();
    } else if (duration) {
      const returnDate = new Date();
      returnDate.setHours(returnDate.getHours() + duration);
      expected_return = returnDate.toISOString();
    }

    startTracking.mutate({
      trusted_contacts: trusted,
      expected_return,
      update_interval_minutes: interval,
    });
  };

  const handleStop = async () => {
    if (!activeSession) return;
    const ok = await confirmAction({
      title: 'Tracking beenden',
      message: 'Möchtest du das Live-Tracking wirklich beenden?',
      confirmText: 'Beenden',
      destructive: true,
    });
    if (!ok) return;
    stopTracking.mutate(activeSession.id);
  };

  const handleCopyLink = async () => {
    if (!activeSession) return;
    showInfoToast(trackingLink(activeSession.share_token));
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: '📍 Live-Tracking' }} />
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: '📍 Live-Tracking' }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!isPremium ? (
          <View style={styles.premiumPrompt}>
            <Ionicons name="lock-closed" size={48} color={Colors.textLight} />
            <Text style={styles.premiumTitle}>Premium-Funktion</Text>
            <Text style={styles.premiumSubtitle}>
              Live-Tracking ist nur mit TrailMate Premium verfügbar.
            </Text>
            <Pressable
              style={styles.premiumButton}
              onPress={() => router.push('/premium')}
            >
              <Text style={styles.premiumButtonText}>Premium freischalten</Text>
            </Pressable>
          </View>
        ) : activeSession ? (
          /* ─── Active Session ─── */
          <View>
            <View style={styles.activeCard}>
              <Ionicons name="radio" size={28} color={Colors.success} />
              <Text style={styles.activeTitle}>Tracking aktiv</Text>
              {activeSession.last_updated_at && (
                <Text style={styles.lastUpdate}>
                  Letztes Update: {new Date(activeSession.last_updated_at).toLocaleTimeString('de-CH')}
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Teilen-Link</Text>
              <View style={styles.linkRow}>
                <Text style={styles.linkText} numberOfLines={1}>
                  {trackingLink(activeSession.share_token)}
                </Text>
                <Pressable style={styles.copyButton} onPress={handleCopyLink}>
                  <Ionicons name="copy-outline" size={20} color={Colors.textOnPrimary} />
                </Pressable>
              </View>
            </View>

            {activeSession.trusted_contacts && activeSession.trusted_contacts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vertrauenspersonen</Text>
                {activeSession.trusted_contacts.map((c, i) => (
                  <View key={i} style={styles.contactDisplay}>
                    <Ionicons name="person" size={18} color={Colors.primary} />
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.contactInfo}>{c.phone || c.email}</Text>
                  </View>
                ))}
              </View>
            )}

            <Pressable style={styles.stopButton} onPress={handleStop}>
              <Ionicons name="stop-circle" size={20} color={Colors.textOnPrimary} />
              <Text style={styles.stopButtonText}>Tracking beenden</Text>
            </Pressable>
          </View>
        ) : (
          /* ─── Setup Form ─── */
          <View>
            {/* Trusted Contacts */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vertrauenspersonen (max. 3)</Text>
              {contacts.map((c, i) => (
                <View key={i} style={styles.contactRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Name"
                    placeholderTextColor={Colors.textLight}
                    value={c.name}
                    onChangeText={(v) => updateContact(i, 'name', v)}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Tel. / E-Mail"
                    placeholderTextColor={Colors.textLight}
                    value={c.contact}
                    onChangeText={(v) => updateContact(i, 'contact', v)}
                    keyboardType="email-address"
                  />
                  {contacts.length > 1 && (
                    <Pressable onPress={() => removeContact(i)} style={styles.removeBtn}>
                      <Ionicons name="close-circle" size={22} color={Colors.error} />
                    </Pressable>
                  )}
                </View>
              ))}
              {contacts.length < 3 && (
                <Pressable style={styles.addBtn} onPress={addContact}>
                  <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  <Text style={styles.addBtnText}>Kontakt hinzufügen</Text>
                </Pressable>
              )}
            </View>

            {/* Duration */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tracking-Dauer</Text>
              <View style={styles.optionRow}>
                {DURATION_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.label}
                    style={[styles.optionChip, duration === opt.value && styles.optionChipActive]}
                    onPress={() => setDuration(opt.value)}
                  >
                    <Text
                      style={[styles.optionText, duration === opt.value && styles.optionTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Interval */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Update-Intervall</Text>
              <View style={styles.optionRow}>
                {INTERVAL_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.optionChip, interval === opt.value && styles.optionChipActive]}
                    onPress={() => setInterval(opt.value)}
                  >
                    <Text
                      style={[styles.optionText, interval === opt.value && styles.optionTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Expected Return */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Erwartete Rückkehr</Text>
              <TextInput
                style={styles.input}
                placeholder="z.B. 18:00"
                placeholderTextColor={Colors.textLight}
                value={expectedReturn}
                onChangeText={setExpectedReturn}
              />
            </View>

            {/* Start Button */}
            <Pressable
              style={[styles.startButton, startTracking.isPending && styles.buttonDisabled]}
              onPress={handleStart}
              disabled={startTracking.isPending}
            >
              {startTracking.isPending ? (
                <ActivityIndicator color={Colors.textOnPrimary} />
              ) : (
                <>
                  <Ionicons name="radio-outline" size={20} color={Colors.textOnPrimary} />
                  <Text style={styles.startButtonText}>Tracking starten</Text>
                </>
              )}
            </Pressable>

            {/* Rega notice */}
            <View style={styles.regaCard}>
              <Ionicons name="information-circle" size={20} color={Colors.info} />
              <Text style={styles.regaText}>
                Für echte Notfälle: 🚁 Rega-App (1414) verwenden
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  premiumPrompt: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  premiumSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  premiumButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  premiumButtonText: {
    color: Colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  removeBtn: {
    marginLeft: 8,
    padding: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  addBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  optionTextActive: {
    color: Colors.textOnPrimary,
  },
  startButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  startButtonText: {
    color: Colors.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  regaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceVariant,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  regaText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  activeCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.success,
    marginBottom: 20,
    gap: 8,
  },
  activeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.success,
  },
  lastUpdate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 10,
    overflow: 'hidden',
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  copyButton: {
    backgroundColor: Colors.primary,
    padding: 12,
  },
  contactDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  contactInfo: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 'auto',
  },
  stopButton: {
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  stopButtonText: {
    color: Colors.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
});
