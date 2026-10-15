import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { useAuthStore } from '../stores/authStore';
import { useChallenges, useChallengeParticipation } from '../hooks/useChallenges';
import ChallengeCard from '../components/gamification/ChallengeCard';
import type { Challenge } from '../types';

export default function ChallengesScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: challenges, isLoading } = useChallenges();

  const renderChallenge = ({ item }: { item: Challenge }) => (
    <ChallengeCardWithParticipation
      challenge={item}
      userId={userId}
      onPress={() => router.push({ pathname: '/challenge-detail', params: { id: item.id } })}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Challenges' }} />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !challenges?.length ? (
        <View style={styles.empty}>
          <Ionicons name="trophy-outline" size={64} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>Keine aktiven Challenges</Text>
          <Text style={styles.emptySubtitle}>
            Schau später wieder vorbei für neue Herausforderungen!
          </Text>
        </View>
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={(item) => item.id}
          renderItem={renderChallenge}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

function ChallengeCardWithParticipation({
  challenge,
  userId,
  onPress,
}: {
  challenge: Challenge;
  userId: string | undefined;
  onPress: () => void;
}) {
  const { data: participation } = useChallengeParticipation(challenge.id, userId);

  return (
    <ChallengeCard
      challenge={challenge}
      participation={participation}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
