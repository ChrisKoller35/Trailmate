import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants';
import { confirmAction } from '../lib/dialog';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { useGroups } from '../hooks/useGroups';
import { useCommunities } from '../hooks/useCommunities';
import Avatar from '../components/ui/Avatar';

interface RequestUser {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface JoinRequestRow {
  user_id: string;
  user?: RequestUser | null;
}

export default function JoinRequestsScreen() {
  const { type, id } = useLocalSearchParams<{ type: 'group' | 'community'; id: string }>();
  const groups = useGroups();
  const { manageCommunity } = useCommunities();
  const api = type === 'community' ? manageCommunity : groups;

  const [requests, setRequests] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const { getJoinRequests } = api;
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    try {
      setRequests((await getJoinRequests(id)) as JoinRequestRow[]);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, [id, getJoinRequests]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = (item: JoinRequestRow) =>
    item.user?.display_name || item.user?.username || 'Unbekannt';

  const handle = async (item: JoinRequestRow, accept: boolean) => {
    if (!id) return;
    if (!accept) {
      const ok = await confirmAction({
        title: 'Anfrage ablehnen',
        message: `Möchtest du die Anfrage von ${nameOf(item)} ablehnen?`,
        confirmText: 'Ablehnen',
        destructive: true,
      });
      if (!ok) return;
    }
    setBusyUserId(item.user_id);
    try {
      if (accept) await api.approveJoinRequest(id, item.user_id);
      else await api.rejectJoinRequest(id, item.user_id);
      setRequests((prev) => prev.filter((r) => r.user_id !== item.user_id));
      showSuccessToast(accept ? `${nameOf(item)} ist jetzt Mitglied.` : 'Anfrage abgelehnt.');
    } catch (e) {
      showErrorToast(
        `${accept ? 'Annehmen' : 'Ablehnen'} fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    setBusyUserId(null);
  };

  const renderRequest = ({ item }: { item: JoinRequestRow }) => {
    const busy = busyUserId === item.user_id;
    return (
      <View style={styles.row}>
        <Avatar uri={item.user?.avatar_url ?? null} size={40} />
        <Text style={styles.name} numberOfLines={1}>
          {nameOf(item)}
        </Text>
        <Pressable
          style={[styles.button, styles.accept]}
          onPress={() => handle(item, true)}
          disabled={busyUserId !== null}
        >
          {busy ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.acceptText}>Annehmen</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.button, styles.reject]}
          onPress={() => handle(item, false)}
          disabled={busyUserId !== null}
        >
          <Text style={styles.rejectText}>Ablehnen</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Beitrittsanfragen' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.emptyText}>Anfragen konnten nicht geladen werden</Text>
          <Pressable onPress={load} hitSlop={8}>
            <Text style={styles.retryText}>Erneut versuchen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.user_id}
          renderItem={renderRequest}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="mail-open-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>Keine offenen Anfragen</Text>
            </View>
          }
          contentContainerStyle={requests.length === 0 ? { flex: 1 } : undefined}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  button: {
    minWidth: 84,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  accept: {
    backgroundColor: Colors.primary,
  },
  acceptText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
  reject: {
    borderWidth: 1,
    borderColor: Colors.error,
  },
  rejectText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },
});
