import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../constants';
import { showErrorToast } from '../lib/toast';
import { useProfileSearch, MIN_SEARCH_LENGTH, type ProfileCard } from '../hooks/useProfileCards';
import UserListItem from '../components/social/UserListItem';

const DEBOUNCE_MS = 300;

export default function UserSearchScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const search = useProfileSearch(query);
  const tooShort = query.trim().length < MIN_SEARCH_LENGTH;

  useEffect(() => {
    if (search.isError) showErrorToast('Die Suche ist fehlgeschlagen.');
  }, [search.isError, search.errorUpdatedAt]);

  const results = tooShort ? [] : (search.data ?? []);

  const renderItem = ({ item }: { item: ProfileCard }) => (
    <UserListItem
      user={item}
      onPress={() => router.push(`/user-profile?id=${item.id}`)}
      rightAction={
        item.is_private ? (
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={Colors.textLight}
            accessibilityLabel="Privates Profil"
          />
        ) : undefined
      }
    />
  );

  const empty = tooShort ? (
    <Text style={styles.hint}>Mindestens 2 Zeichen eingeben</Text>
  ) : search.isLoading ? (
    <ActivityIndicator color={Colors.primary} />
  ) : search.isError ? (
    <Text style={styles.hint}>Die Suche ist fehlgeschlagen.</Text>
  ) : (
    <>
      <Ionicons name="search-outline" size={48} color={Colors.textLight} />
      <Text style={styles.hint}>Niemand gefunden</Text>
    </>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Personen suchen' }} />
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Name oder @username"
          placeholderTextColor={Colors.textLight}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Personen suchen"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<View style={styles.center}>{empty}</View>}
        contentContainerStyle={results.length === 0 ? { flex: 1 } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, color: Colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  hint: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});
