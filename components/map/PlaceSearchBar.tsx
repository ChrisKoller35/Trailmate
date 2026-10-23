import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import {
  searchPlaces,
  isAbortError,
  PLACE_SEARCH_LIMIT,
  PLACE_SEARCH_MIN_LENGTH,
  type Place,
} from '../../lib/placeSearch';

const DEBOUNCE_MS = 300;

interface PlaceSearchBarProps {
  onSelect: (place: Place) => void;
  style?: ViewStyle;
}

export function PlaceSearchBar({ onSelect, style }: PlaceSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Nach einer Auswahl steht der Name im Feld – dafür keine neue Suche starten
  const selectedNameRef = useRef<string | null>(null);

  // Verzögert suchen, laufende Anfrage bei neuer Eingabe abbrechen
  useEffect(() => {
    const text = query.trim();
    if (query === selectedNameRef.current || text.length < PLACE_SEARCH_MIN_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(text, { signal: controller.signal })
        .then((places) => {
          setResults(places.slice(0, PLACE_SEARCH_LIMIT));
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (isAbortError(e)) return;
          setResults([]);
          setError(e instanceof Error ? e.message : 'Ortssuche fehlgeschlagen.');
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleChange = (text: string) => {
    selectedNameRef.current = null;
    setQuery(text);
    setOpen(true);
    setError(null);
    if (text.trim().length < PLACE_SEARCH_MIN_LENGTH) {
      setResults([]);
      setLoading(false);
    } else {
      setLoading(true);
    }
  };

  const handleClear = () => {
    selectedNameRef.current = null;
    setQuery('');
    setResults([]);
    setLoading(false);
    setError(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleSelect = (place: Place) => {
    selectedNameRef.current = place.name;
    setQuery(place.name);
    setOpen(false);
    inputRef.current?.blur();
    onSelect(place);
  };

  const showList = open && query.trim().length >= PLACE_SEARCH_MIN_LENGTH;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          onFocus={() => setOpen(true)}
          placeholder="Ort, Berg oder Adresse suchen"
          placeholderTextColor={Colors.textSecondary}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Ortssuche"
        />
        {loading && <ActivityIndicator size="small" color={Colors.primary} />}
        {query.length > 0 && (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Suche löschen"
          >
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {showList && (
        <View style={styles.list}>
          {error ? (
            <View style={styles.messageRow}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={[styles.messageText, styles.errorText]}>{error}</Text>
            </View>
          ) : loading && results.length === 0 ? (
            <View style={styles.messageRow}>
              <Text style={styles.messageText}>Suche läuft…</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.messageRow}>
              <Text style={styles.messageText}>Keine Treffer</Text>
            </View>
          ) : (
            results.map((place, index) => (
              <Pressable
                key={place.id}
                style={({ pressed }) => [
                  styles.resultRow,
                  index > 0 && styles.resultDivider,
                  pressed && styles.resultPressed,
                ]}
                onPress={() => handleSelect(place)}
                accessibilityRole="button"
              >
                <Ionicons name="location-outline" size={16} color={Colors.primary} />
                <Text style={styles.resultName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={styles.resultKind}>{place.kind}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  list: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.error,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  resultDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  resultPressed: {
    backgroundColor: Colors.background,
  },
  resultName: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  resultKind: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
