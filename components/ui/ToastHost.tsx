import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants';
import { useToastStore, type ToastType } from '../../stores/toastStore';

const TYPE_STYLE: Record<ToastType, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  error: { color: Colors.error, icon: 'alert-circle' },
  success: { color: Colors.success, icon: 'checkmark-circle' },
  info: { color: Colors.info, icon: 'information-circle' },
};

/** Renders toasts from stores/toastStore.ts at the top of the screen. Mount once in app/_layout.tsx. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { top: insets.top + 8 }]}
      accessibilityLiveRegion="polite"
    >
      {toasts.map((toast) => {
        const { color, icon } = TYPE_STYLE[toast.type];
        return (
          <Pressable
            key={toast.id}
            onPress={() => dismiss(toast.id)}
            accessibilityRole="alert"
            accessibilityLabel={`${toast.title}: ${toast.message}`}
            accessibilityHint="Antippen zum Schliessen"
            style={[styles.toast, { borderLeftColor: color }]}
          >
            <Ionicons name={icon} size={22} color={color} style={styles.icon} />
            <View style={styles.textBox}>
              <Text style={styles.title}>{toast.title}</Text>
              <Text style={styles.message}>{toast.message}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderLeftWidth: 5,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  icon: { marginRight: 10 },
  textBox: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text },
  message: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
});
