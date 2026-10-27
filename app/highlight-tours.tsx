import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import { useHighlightEditor, useSaveHighlights } from '../hooks/useHighlightTours';
import { moveHighlightUp, toggleHighlight } from '../lib/highlightSelection';
import { formatDistance } from '../lib/trackingCalculations';
import { showErrorToast, showSuccessToast } from '../lib/toast';

export default function HighlightToursScreen() {
  const router = useRouter();
  const { data, isLoading, isError, isRefetching, refetch } = useHighlightEditor();
  const { saveHighlights, isSaving } = useSaveHighlights();
  const [selected, setSelected] = useState<string[] | null>(null);

  // Bis zur ersten Änderung gilt die gespeicherte Auswahl.
  const current = selected ?? data?.selected ?? [];

  const toggle = (id: string) => {
    const result = toggleHighlight(current, id);
    if (result.rejected) showErrorToast('Du kannst höchstens 5 Highlight-Touren wählen.');
    else setSelected(result.selected);
  };

  const save = async () => {
    if (await saveHighlights(current)) {
      showSuccessToast('Highlight-Touren gespeichert.');
      router.back();
    }
  };

  const header = <Stack.Screen options={{ headerShown: true, title: 'Highlight-Touren' }} />;

  const busy = isLoading || (isError && isRefetching);
  if (busy || isError || !data || data.tours.length === 0) {
    return (
      <View style={styles.center}>
        {header}
        {busy ? (
          <ActivityIndicator size="large" color={Colors.primary} />
        ) : (
          <Text style={styles.message}>
            {isError ? 'Die Touren konnten nicht geladen werden.' : 'Du hast noch keine sichtbaren Touren.'}
          </Text>
        )}
        {isError && !busy && (
          <Pressable style={styles.button} onPress={() => refetch()} accessibilityRole="button">
            <Text style={styles.buttonText}>Nochmal versuchen</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        data={data.tours}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.hint}>Wähle bis zu 5 Touren für dein Profil. Die Nummer bestimmt die Reihenfolge.</Text>
        }
        renderItem={({ item }) => {
          const index = current.indexOf(item.id);
          return (
            <Pressable
              style={[styles.row, index >= 0 && styles.rowSelected]}
              onPress={() => toggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: index >= 0 }}
            >
              <View style={[styles.badge, index >= 0 && styles.badgeSelected]}>
                {index >= 0 && <Text style={styles.badgeText}>{index + 1}</Text>}
              </View>
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{item.title ?? 'Unbenannte Tour'}</Text>
                <Text style={styles.meta}>
                  {new Date(item.started_at).toLocaleDateString('de-CH')} · {formatDistance(item.distance_m ?? 0)}
                </Text>
              </View>
              {index > 0 && (
                <Pressable
                  onPress={() => setSelected(moveHighlightUp(current, item.id))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Nach oben"
                >
                  <Ionicons name="arrow-up" size={22} color={Colors.primary} />
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />
      <Pressable style={[styles.button, styles.saveButton]} onPress={save} disabled={isSaving} accessibilityRole="button">
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Speichern</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: Colors.background },
  message: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  list: { padding: 16, gap: 8 },
  hint: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  rowSelected: { borderColor: Colors.primary },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  badgeText: { color: '#fff', fontWeight: '700' },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
  button: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, backgroundColor: Colors.primary },
  saveButton: { margin: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
