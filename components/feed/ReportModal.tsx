import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { showErrorToast, showSuccessToast } from '../../lib/toast';
import type { ReportReason } from '../../types';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, description?: string) => Promise<void>;
}

const REASONS: { value: ReportReason; label: string; icon: string }[] = [
  { value: 'spam', label: 'Spam', icon: 'megaphone-outline' },
  { value: 'inappropriate', label: 'Unangemessen', icon: 'warning-outline' },
  { value: 'fake', label: 'Fake / Falschinformation', icon: 'alert-circle-outline' },
  { value: 'abuse', label: 'Belästigung / Missbrauch', icon: 'shield-outline' },
];

export default function ReportModal({ visible, onClose, onSubmit }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      showErrorToast('Bitte wähle einen Meldegrund aus.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedReason, description.trim() || undefined);
      showSuccessToast('Danke für deine Meldung. Wir werden den Beitrag prüfen.');
      setSelectedReason(null);
      setDescription('');
      onClose();
    } catch {
      showErrorToast('Die Meldung konnte nicht gesendet werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Beitrag melden</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          {/* Reasons */}
          <View style={styles.reasons}>
            {REASONS.map((reason) => (
              <Pressable
                key={reason.value}
                style={[
                  styles.reasonItem,
                  selectedReason === reason.value && styles.reasonItemSelected,
                ]}
                onPress={() => setSelectedReason(reason.value)}
              >
                <Ionicons
                  name={reason.icon as any}
                  size={20}
                  color={selectedReason === reason.value ? Colors.primary : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === reason.value && styles.reasonTextSelected,
                  ]}
                >
                  {reason.label}
                </Text>
                {selectedReason === reason.value && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                )}
              </Pressable>
            ))}
          </View>

          {/* Description */}
          <TextInput
            style={styles.descriptionInput}
            placeholder="Zusätzliche Details (optional)"
            placeholderTextColor={Colors.textLight}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={300}
          />

          {/* Submit */}
          <Pressable
            style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? 'Wird gesendet...' : 'Melden'}
            </Text>
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
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  reasons: {
    gap: 8,
    marginBottom: 16,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceVariant,
  },
  reasonItemSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  reasonTextSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  descriptionInput: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
});
