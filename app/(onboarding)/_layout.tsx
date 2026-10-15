import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile-basics" />
      <Stack.Screen name="hiking-level" />
      <Stack.Screen name="home-region" />
    </Stack>
  );
}
