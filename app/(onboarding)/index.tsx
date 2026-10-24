import { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants';
import Button from '../../components/ui/Button';
import ProgressIndicator from '../../components/onboarding/ProgressIndicator';
import { useOnboardingStore } from '../../stores/onboardingStore';

export default function WelcomeScreen() {
  const router = useRouter();
  const { setCurrentStep } = useOnboardingStore();

  useEffect(() => {
    setCurrentStep(1);
  }, [setCurrentStep]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressIndicator step={1} total={5} />

        <View style={styles.hero}>
          <Text style={styles.emoji}>🏔️</Text>
          <Text style={styles.title}>Willkommen bei TrailMate!</Text>
          <Text style={styles.subtitle}>
            Entdecke Wanderungen, teile Erlebnisse, finde Wanderpartner.
          </Text>
        </View>

        <Button
          title="Los geht's"
          onPress={() => router.push('/(onboarding)/profile-basics')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
});
