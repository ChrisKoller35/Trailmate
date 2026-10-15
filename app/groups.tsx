import { useState, useEffect, useCallback } from 'react';
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
import { useGroups } from '../hooks/useGroups';
import type { Group } from '../types';

export default function GroupsScreen() {
  const router = useRouter();
  const { myGroups, fetchMyGroups, searchGroups } = useGroups();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await fetchMyGroups();
      setLoading(false);
    };
    load();
  }, [fetchMyGroups]);

  const handleSearch = useCallback(
    async (q: string) => {
      setSearchQuery(q);
      if (q.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      const results = await searchGroups(q.trim());
      // Exclude groups user is already in
      const myGroupIds = new Set(myGroups.map((g) => g.id));
      setSearchResults(results.filter((g) => !myGroupIds.has(g.id)));
      setSearching(false);
    },
    [searchGroups, myGroups],
  );

  const renderGroupCard = ({
    item,
    isMember,
  }: {
    item: Group & { role?: string };
    isMember: boolean;
  }) => (
    <Pressable
      style={styles.groupCard}
      onPress={() => router.push(`/group-detail?id=${item.id}`)}
    >
      {item.cover_image_url ? (
        <View style={styles.coverPlaceholder}>
          <Ionicons name="image-outline" size={24} color={Colors.textLight} />
        </View>
      ) : (
        <View style={styles.coverPlaceholder}>
          <Ionicons name="people" size={28} color={Colors.primaryLight} />
        </View>
      )}
      <View style={styles.groupInfo}>
        <Text style={styles.groupName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.groupMeta}>
          <View style={[styles.typeBadge, item.is_private && styles.typeBadgePrivate]}>
            <Text style={[styles.typeBadgeText, item.is_private && styles.typeBadgeTextPrivate]}>
              {item.is_private ? 'Privat' : 'Öffentlich'}
            </Text>
          </View>
          {isMember && (item as any).role && (
            <Text style={styles.roleText}>
              {(item as any).role === 'admin'
                ? 'Admin'
                : (item as any).role === 'moderator'
                  ? 'Mod'
                  : ''}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gruppen</Text>
        <Pressable onPress={() => router.push('/create-group')} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Öffentliche Gruppen suchen..."
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

      <FlatList
        data={searchQuery.trim().length >= 2 ? searchResults : []}
        keyExtractor={(item) => `search-${item.id}`}
        renderItem={({ item }) => renderGroupCard({ item, isMember: false })}
        ListHeaderComponent={
          searchQuery.trim().length < 2 ? (
            <View>
              {/* My Groups Section */}
              <Text style={styles.sectionTitle}>Meine Gruppen</Text>
              {myGroups.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="people-outline" size={40} color={Colors.textLight} />
                  <Text style={styles.emptyText}>Du bist noch keiner Gruppe beigetreten</Text>
                </View>
              ) : (
                myGroups.map((group) => (
                  <View key={group.id}>
                    {renderGroupCard({ item: group, isMember: true })}
                  </View>
                ))
              )}
            </View>
          ) : searching ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          searchQuery.trim().length >= 2 && !searching ? (
            <View style={styles.emptySection}>
              <Ionicons name="search-outline" size={40} color={Colors.textLight} />
              <Text style={styles.emptyText}>Keine Gruppen gefunden</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  center: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  coverPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfo: {
    flex: 1,
    marginLeft: 12,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.primaryLight + '20',
  },
  typeBadgePrivate: {
    backgroundColor: Colors.warning + '20',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  typeBadgeTextPrivate: {
    color: Colors.warning,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryLight,
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
