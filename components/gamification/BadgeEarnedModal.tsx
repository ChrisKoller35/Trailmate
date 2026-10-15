import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Colors } from '../../constants';
import type { Badge } from '../../types';

const RARITY_COLORS: Record<string, string> = {
  normal: Colors.textSecondary,
  rare: Colors.info,
  epic: '#7C3AED',
};

const RARITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  rare: 'Selten',
  epic: 'Episch',
};

interface BadgeEarnedModalProps {
  visible: boolean;
  badge: Badge | null;
  onClose: () => void;
  onShare: () => void;
}

export default function BadgeEarnedModal({
  visible,
  badge,
  onClose,
  onShare,
}: BadgeEarnedModalProps) {
  if (!badge) return null;

  const rarityColor = RARITY_COLORS[badge.rarity ?? 'normal'] ?? Colors.textSecondary;
  const rarityLabel = RARITY_LABELS[badge.rarity ?? 'normal'] ?? 'Normal';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.confetti}>🎉🏆🎊</Text>

          <Text style={styles.heading}>Neues Abzeichen!</Text>

          <View style={[styles.badgeCircle, { borderColor: rarityColor }]}>
            <Text style={styles.badgeEmoji}>{badge.icon_url ?? '🏅'}</Text>
          </View>

          <Text style={styles.badgeName}>{badge.name}</Text>
          {badge.description && (
            <Text style={styles.badgeDescription}>{badge.description}</Text>
          )}
          <Text style={[styles.rarityLabel, { color: rarityColor }]}>
            {rarityLabel}
          </Text>

          <Text style={styles.confetti}>✨⭐✨</Text>

          <Pressable style={styles.shareButton} onPress={onShare}>
            <Text style={styles.shareButtonText}>Im Feed teilen</Text>
          </Pressable>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Schliessen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  confetti: {
    fontSize: 28,
    marginVertical: 4,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 16,
  },
  badgeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    backgroundColor: Colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeEmoji: {
    fontSize: 44,
  },
  badgeName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  badgeDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  rarityLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  shareButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    marginTop: 10,
    paddingVertical: 10,
  },
  closeButtonText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
