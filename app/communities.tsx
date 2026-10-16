import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants';
import { useCommunities } from '../hooks/useCommunities';
import type { Community, CommunityRole } from '../types';

export default function CommunitiesScreen() {
  const router = useRouter();
  const {
    myCommunities,
    suggestedCommunities,
    discoverCommunities,
  } = useCommunities();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Community[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(
    async (q: string) => {
      setSearchQuery(q);
      if (q.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      const results = await discoverCommunities({ query: q.trim() });
      const myIds = new Set(myCommunities.map((c) => c.id));
      setSearchResults(results.filter((c) => !myIds.has(c.id)));
      setSearching(false);
    },
    [discoverCommunities, myCommunities],
  );

  const renderCommunityCard = ({
    item,
    showJoined,
  }: {
    item: Community & { role?: CommunityRole };
    showJoined?: boolean;
  }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/community-detail?id=${item.id}`)}
    >
      <View style={styles.cardIcon}>
        <Ionicons
          name={item.is_official ? 'shield-checkmark' : 'earth'}
          size={26}
          color={item.is_official ? Colors.primary : Colors.primaryLight}
        />
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.is_official && (
            <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
          )}
        </View>
        <View style={styles.cardMeta}>
          {item.category && <Text style={styles.categoryBadge}>{item.category}</Text>}
          {item.region && <Text style={styles.cardRegion}>{item.region}</Text>}
        </View>
        {showJoined && (item as any).role && (
          <Text style={styles.roleLabel}>
            {(item as any).role === 'admin'
              ? 'Admin'
              : (item as any).role === 'moderator'
                ? 'Moderator'
                : 'Mitglied'}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
    </Pressable>
  );

  const showSearchResults = searchQuery.trim().length >= 2;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Communities</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Communities suchen..."
          placeholderTextColor={Colors.textLight}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={18} color={Colors.textLight} />
          </Pressable>
        )}
      </View>

      {showSearchResults ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderCommunityCard({ item })}
          ListHeaderComponent={
            searching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !searching ? (
              <View style={styles.emptySection}>
                <Ionicons name="search-outline" size={40} color={Colors.textLight} />
                <Text style={styles.emptyText}>Keine Communities gefunden</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <View>
              {/* Suggested */}
              {suggestedCommunities.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Empfohlen für dich</Text>
                  {suggestedCommunities.map((community) => (
                    <View key={community.id}>
                      {renderCommunityCard({ item: community })}
                    </View>
                  ))}
                </>
              )}

              {/* My Communities */}
              <Text style={styles.sectionTitle}>Meine Communities</Text>
              {myCommunities.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="earth-outline" size={40} color={Colors.textLight} />
                  <Text style={styles.emptyText}>Du bist noch keiner Community beigetreten</Text>
                </View>
              ) : (
                myCommunities.map((community) => (
                  <View key={community.id}>
                    {renderCommunityCard({ item: community, showJoined: true })}
                  </View>
                ))
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primaryLight,
    backgroundColor: Colors.primaryLight + '20',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cardRegion: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 2,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
  },
});
