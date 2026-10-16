import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';

const FEATURES = [
  'Offline-Karten',
  'Erweiterte Statistiken & Jahresrückblick',
  'Live-Tracking',
  'GPX-Export',
  'Höhenkorrektur Wetter',
  'Premium-Badge',
];

export default function PremiumScreen() {
  // Premium is set server-side only (migration 009). Until the in-app purchase
  // is wired up, the button only explains that the purchase is coming.
  const handleActivate = () => {
    Alert.alert('Premium', 'Der Kauf über den App Store kommt bald.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Premium' }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.star}>⭐</Text>
        <Text style={styles.title}>TrailMate Premium</Text>
        <Text style={styles.price}>CHF 1.99 / Monat</Text>

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.activateButton} onPress={handleActivate}>
          <Text style={styles.activateButtonText}>Premium aktivieren</Text>
        </Pressable>

        <Text style={styles.cancelNote}>Jederzeit kündbar</Text>

        <Text style={styles.finePrint}>
          Das Abonnement wird über deinen App Store Account abgerechnet.
          Preise können je nach Region variieren.
        </Text>
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
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  star: {
    fontSize: 56,
    marginTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 12,
  },
  price: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 8,
    marginBottom: 32,
  },
  featureList: {
    width: '100%',
    gap: 14,
    marginBottom: 36,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  activateButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  activateButtonText: {
    color: Colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  cancelNote: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  finePrint: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
