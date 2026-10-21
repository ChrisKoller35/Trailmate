import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants';
import { showErrorToast } from '../../lib/toast';
import { useTrailConditions } from '../../hooks/useTrailConditions';
import { usePermissions } from '../../hooks/usePermissions';

// ─── Types ─────────────────────────────────────────────────

interface TrailConditionReportProps {
  routeId: string;
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

interface ConditionOption {
  key: string;
  emoji: string;
  label: string;
}

// ─── Constants ─────────────────────────────────────────────

const CONDITION_OPTIONS: ConditionOption[] = [
  { key: 'trail_open', emoji: '✅', label: 'Weg offen und gut begehbar' },
  { key: 'snow_fields', emoji: '❄️', label: 'Schneefelder vorhanden' },
  { key: 'wet_slippery', emoji: '💧', label: 'Weg nass/rutschig' },
  { key: 'rockfall_danger', emoji: '⚠️', label: 'Steinschlaggefahr' },
  { key: 'partially_closed', emoji: '🚫', label: 'Weg teilweise gesperrt' },
  { key: 'bridge_damaged', emoji: '🌉', label: 'Brücke/Steg beschädigt' },
];

// ─── Component ─────────────────────────────────────────────

export default function TrailConditionReport({
  routeId,
  visible,
  onClose,
  onSubmitted,
}: TrailConditionReportProps) {
  const { submitReport } = useTrailConditions(routeId);
  const { requestMediaLibraryPermission, requestCameraPermission } = usePermissions();

  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
  const [snowLine, setSnowLine] = useState('');
  const [comment, setComment] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCondition = (key: string) => {
    setSelectedConditions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const pickPhoto = async () => {
    const granted = await requestMediaLibraryPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const granted = await requestCameraPermission();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const resetForm = () => {
    setSelectedConditions(new Set());
    setSnowLine('');
    setComment('');
    setPhotoUri(null);
  };

  const handleSubmit = async () => {
    if (selectedConditions.size === 0) {
      showErrorToast('Bitte wähle mindestens einen Wegzustand aus.');
      return;
    }

    setIsSubmitting(true);

    try {
      const snowLineParsed = snowLine.trim()
        ? parseInt(snowLine.trim(), 10)
        : undefined;
      // Clamp snow line to valid Swiss elevation range (200m – 5000m)
      const snowLineNum =
        snowLineParsed !== undefined && !isNaN(snowLineParsed)
          ? Math.max(200, Math.min(5000, snowLineParsed))
          : undefined;

      await submitReport({
        conditions: Array.from(selectedConditions),
        snow_line_meters:
          snowLineNum !== undefined && !isNaN(snowLineNum)
            ? snowLineNum
            : undefined,
        comment: comment.trim() || undefined,
        photoUri: photoUri ?? undefined,
      });

      resetForm();
      onSubmitted();
      onClose();
    } catch (err) {
      showErrorToast(
        err instanceof Error
          ? err.message
          : 'Der Bericht konnte nicht gesendet werden.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Wegzustand melden</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Condition checkboxes */}
          <Text style={styles.sectionTitle}>Zustand auswählen</Text>
          <View style={styles.conditionsGrid}>
            {CONDITION_OPTIONS.map((option) => {
              const selected = selectedConditions.has(option.key);
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.conditionOption,
                    selected && styles.conditionOptionSelected,
                  ]}
                  onPress={() => toggleCondition(option.key)}
                  activeOpacity={0.7}
                  disabled={isSubmitting}
                >
                  <Text style={styles.conditionEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.conditionLabel,
                      selected && styles.conditionLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={Colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Snow line input */}
          <Text style={styles.sectionTitle}>Schneegrenze (optional)</Text>
          <View style={styles.snowLineInput}>
            <Ionicons name="snow" size={18} color={Colors.info} />
            <TextInput
              style={styles.snowLineTextInput}
              placeholder="z.B. 2200"
              placeholderTextColor={Colors.textSecondary}
              value={snowLine}
              onChangeText={setSnowLine}
              keyboardType="number-pad"
              editable={!isSubmitting}
            />
            <Text style={styles.snowLineUnit}>m ü. M.</Text>
          </View>

          {/* Comment */}
          <Text style={styles.sectionTitle}>Kommentar (optional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Beschreibe den Wegzustand genauer..."
            placeholderTextColor={Colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            maxLength={500}
            textAlignVertical="top"
            editable={!isSubmitting}
          />

          {/* Photo */}
          <Text style={styles.sectionTitle}>Foto (optional)</Text>
          {photoUri ? (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => setPhotoUri(null)}
                disabled={isSubmitting}
              >
                <Ionicons name="close-circle" size={24} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={takePhoto}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={22} color={Colors.primary} />
                <Text style={styles.photoButtonText}>Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={pickPhoto}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Ionicons name="image-outline" size={22} color={Colors.primary} />
                <Text style={styles.photoButtonText}>Galerie</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Submit button */}
        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSubmitting || selectedConditions.size === 0) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || selectedConditions.size === 0}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons
                  name="send"
                  size={18}
                  color={Colors.textOnPrimary}
                />
                <Text style={styles.submitButtonText}>Bericht senden</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
    marginTop: 16,
  },
  conditionsGrid: {
    gap: 8,
  },
  conditionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  conditionOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#E8F5E9',
  },
  conditionEmoji: {
    fontSize: 18,
  },
  conditionLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  conditionLabelSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  snowLineInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  snowLineTextInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  snowLineUnit: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  commentInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    color: Colors.text,
    minHeight: 80,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  photoPreviewContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  photoPreview: {
    width: 200,
    height: 150,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  submitContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
