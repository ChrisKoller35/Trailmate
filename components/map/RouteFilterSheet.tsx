import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, SAC_SCALES } from '../../constants';
import type { SACScale } from '../../types';
import { useRouteFilterStore } from '../../hooks/useRouteFilter';
import { ROUTE_FILTER_LIMITS as L } from '../../lib/routeFilterQuery';

interface RouteFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.78;

const SAC_KEYS: SACScale[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  openEnded = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Maximalwert ohne Filter am Anschlag: «50+ km» statt «50 km». */
  openEnded?: boolean;
  onChange: (val: number) => void;
}) {
  const displayValue = `${value}${openEnded && value >= max ? '+' : ''} ${unit}`;
  const onDecrease = () => onChange(Math.max(min, value - step));
  const onIncrease = () => onChange(Math.min(max, value + step));

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderControls}>
        <Pressable
          onPress={onDecrease}
          style={styles.stepButton}
          disabled={value <= min}
        >
          <Ionicons
            name="remove-circle-outline"
            size={26}
            color={value <= min ? Colors.textLight : Colors.primary}
          />
        </Pressable>
        <Text style={styles.sliderValue}>{displayValue}</Text>
        <Pressable
          onPress={onIncrease}
          style={styles.stepButton}
          disabled={value >= max}
        >
          <Ionicons
            name="add-circle-outline"
            size={26}
            color={value >= max ? Colors.textLight : Colors.primary}
          />
        </Pressable>
      </View>
    </View>
  );
}

export function RouteFilterSheet({ visible, onClose, onApply }: RouteFilterSheetProps) {
  const translateY = useMemo(() => new Animated.Value(SHEET_HEIGHT), []);

  const {
    sacScales,
    minDistance,
    maxDistance,
    minElevation,
    maxElevation,
    minDuration,
    maxDuration,
    maxHeight,
    toggleSacScale,
    setMinDistance,
    setMaxDistance,
    setMinElevation,
    setMaxElevation,
    setMinDuration,
    setMaxDuration,
    setMaxHeight,
    resetFilters,
  } = useRouteFilterStore();

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
    }).start();
  }, [visible, translateY]);

  const handleApply = useCallback(() => {
    onApply();
    onClose();
  }, [onApply, onClose]);

  const handleReset = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        {/* Handle */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Routen filtern</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* SAC Scale */}
          <Text style={styles.sectionTitle}>SAC-Schwierigkeitsgrad</Text>
          <View style={styles.sacGrid}>
            {SAC_KEYS.map((key) => {
              const selected = sacScales.includes(key);
              const info = SAC_SCALES[key];
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.sacChip,
                    selected && { backgroundColor: info.color, borderColor: info.color },
                  ]}
                  onPress={() => toggleSacScale(key)}
                >
                  <Text
                    style={[
                      styles.sacChipText,
                      selected && { color: Colors.surface },
                    ]}
                  >
                    {key}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Distance */}
          <SliderRow
            label="Min. Distanz"
            value={minDistance}
            min={L.distance.min}
            max={maxDistance}
            step={L.distance.step}
            unit="km"
            onChange={setMinDistance}
          />
          <SliderRow
            label="Max. Distanz"
            value={maxDistance}
            min={Math.max(minDistance, L.distance.step)}
            max={L.distance.max}
            step={L.distance.step}
            unit="km"
            openEnded
            onChange={setMaxDistance}
          />

          {/* Elevation */}
          <SliderRow
            label="Min. Höhenmeter"
            value={minElevation}
            min={L.elevation.min}
            max={maxElevation}
            step={L.elevation.step}
            unit="m"
            onChange={setMinElevation}
          />
          <SliderRow
            label="Max. Höhenmeter"
            value={maxElevation}
            min={Math.max(minElevation, L.elevation.step)}
            max={L.elevation.max}
            step={L.elevation.step}
            unit="m"
            openEnded
            onChange={setMaxElevation}
          />

          {/* Duration */}
          <SliderRow
            label="Min. Dauer"
            value={minDuration}
            min={L.duration.min}
            max={maxDuration}
            step={L.duration.step}
            unit="h"
            onChange={setMinDuration}
          />
          <SliderRow
            label="Max. Dauer"
            value={maxDuration}
            min={Math.max(minDuration, L.duration.step)}
            max={L.duration.max}
            step={L.duration.step}
            unit="h"
            openEnded
            onChange={setMaxDuration}
          />

          {/* Max Height */}
          <SliderRow
            label="Max. Höhe (m ü.M.)"
            value={maxHeight}
            min={L.height.min}
            max={L.height.max}
            step={L.height.step}
            unit="m"
            openEnded
            onChange={setMaxHeight}
          />

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          <Pressable style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetText}>Zurücksetzen</Text>
          </Pressable>
          <Pressable style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyText}>Filter anwenden</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 10,
  },
  sacGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  sacChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceVariant,
  },
  sacChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  sliderLabel: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  sliderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    padding: 2,
  },
  sliderValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    minWidth: 56,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.surfaceVariant,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  applyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.surface,
  },
});
