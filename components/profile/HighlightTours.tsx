import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';

interface HighlightToursProps {
  highlights: { id?: string; title: string | null }[];
  onEdit?: () => void;
}

export default function HighlightTours({ highlights, onEdit }: HighlightToursProps) {
  const header = (
    <View style={styles.headerRow}>
      <Text style={styles.sectionTitle}>Highlight-Touren</Text>
      {onEdit && (
        <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button">
          <Text style={styles.editText}>Bearbeiten</Text>
        </Pressable>
      )}
    </View>
  );

  if (highlights.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.emptyContainer}>
          <Ionicons name="trail-sign-outline" size={32} color={Colors.textLight} />
          <Text style={styles.emptyText}>Keine Highlight-Touren</Text>
          {onEdit && (
            <Pressable style={styles.emptyButton} onPress={onEdit} accessibilityRole="button">
              <Text style={styles.emptyButtonText}>Touren auswählen</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {highlights.slice(0, 5).map((item, index) => (
          <View key={item.id ?? index} style={styles.card}>
            <View style={styles.thumbnail}>
              <Ionicons name="image-outline" size={28} color={Colors.textLight} />
            </View>
            <Text style={styles.tourTitle} numberOfLines={1}>
              {item.title ?? 'Unbenannte Tour'}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  editText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 140,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 90,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 16,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
