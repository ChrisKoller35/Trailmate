import { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, HIKING_LEVELS } from '../../constants';
import Button from '../../components/ui/Button';
import ProgressIndicator from '../../components/onboarding/ProgressIndicator';
import { useOnboardingStore } from '../../stores/onboardingStore';

export default function HikingLevelScreen() {
  const router = useRouter();
  const { hikingLevel, setHikingLevel, setCurrentStep } = useOnboardingStore();

  useEffect(() => {
    setCurrentStep(3);
  }, [setCurrentStep]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressIndicator step={3} total={5} />
        <Text style={styles.title}>Wie erfahren bist du?</Text>

        <View style={styles.cards}>
          {HIKING_LEVELS.map((level) => (
            <Pressable
              key={level.value}
              style={[
                styles.card,
                hikingLevel === level.value && styles.cardSelected,
              ]}
              onPress={() => setHikingLevel(level.value)}
            >
              <Text style={styles.cardEmoji}>{level.emoji}</Text>
              <Text style={styles.cardLabel}>{level.label}</Text>
              <Text style={styles.cardDesc}>{level.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.hint}>Kann später geändert werden</Text>

        <Button
          title="Weiter"
          onPress={() => router.push('/(onboarding)/home-region')}
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
    marginBottom: 24,
  },
  cards: {
    gap: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceVariant,
  },
  cardEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  hint: {
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
});
