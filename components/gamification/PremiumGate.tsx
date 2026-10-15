import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { useAuthStore } from '../../stores/authStore';

interface PremiumGateProps {
  children: React.ReactNode;
  featureName: string;
}

export default function PremiumGate({ children, featureName }: PremiumGateProps) {
  const isPremium = useAuthStore((s) => s.profile?.is_premium ?? false);
  const router = useRouter();

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <View style={styles.card}>
      <Ionicons name="lock-closed" size={40} color={Colors.textLight} />
      <Text style={styles.title}>{featureName}</Text>
      <Text style={styles.subtitle}>
        Diese Funktion ist nur mit TrailMate Premium verfügbar.
      </Text>
      <Pressable style={styles.button} onPress={() => router.push('/premium')}>
        <Text style={styles.buttonText}>Premium freischalten</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
    margin: 16,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    color: Colors.textOnPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
