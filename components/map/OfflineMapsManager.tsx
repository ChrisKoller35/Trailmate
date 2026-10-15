import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { useOfflineMaps, type OfflineRegion } from '../../hooks/useOfflineMaps';

export function OfflineMapsManager() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const isPremium = profile?.is_premium ?? false;

  const {
    regions,
    downloadProgress,
    totalStorageMB,
    downloadRegion,
    deleteRegion,
  } = useOfflineMaps();

  if (!isPremium) {
    return (
      <View style={styles.premiumGate}>
        <Ionicons name="cloud-offline-outline" size={52} color={Colors.secondary} />
        <Text style={styles.premiumTitle}>Offline-Karten</Text>
        <Text style={styles.premiumDesc}>
          Lade Kartenregionen herunter und navigiere auch ohne Mobilfunknetz — ideal für abgelegene Wandergebiete und Bergtouren.
        </Text>
        <Pressable style={styles.upgradeButton} onPress={() => router.push('/premium')}>
          <Text style={styles.upgradeText}>Premium freischalten</Text>
        </Pressable>
      </View>
    );
  }

  const handleDownload = (region: OfflineRegion) => {
    Alert.alert(
      'Region herunterladen',
      `Möchtest du "${region.name}" (~${region.estimatedSizeMB} MB) herunterladen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Herunterladen', onPress: () => downloadRegion(region.id) },
      ],
    );
  };

  const handleDelete = (region: OfflineRegion) => {
    Alert.alert(
      'Region löschen',
      `Möchtest du "${region.name}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => deleteRegion(region.id) },
      ],
    );
  };

  const renderRegion = ({ item }: { item: OfflineRegion }) => {
    const progress = downloadProgress[item.id];
    const isDownloading = progress != null && progress < 100;

    return (
      <View style={styles.regionCard}>
        <View style={styles.regionInfo}>
          <Ionicons
            name={item.isDownloaded ? 'cloud-done' : 'map-outline'}
            size={22}
            color={item.isDownloaded ? Colors.success : Colors.textSecondary}
          />
          <View style={styles.regionText}>
            <Text style={styles.regionName}>{item.name}</Text>
            <Text style={styles.regionSize}>~{item.estimatedSizeMB} MB</Text>
          </View>
        </View>

        {isDownloading ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
        ) : item.isDownloaded ? (
          <Pressable
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </Pressable>
        ) : (
          <Pressable
            style={styles.downloadButton}
            onPress={() => handleDownload(item)}
          >
            <Ionicons name="cloud-download-outline" size={20} color={Colors.primary} />
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Offline-Karten</Text>
      <Text style={styles.storageInfo}>
        Gespeichert: {totalStorageMB.toFixed(1)} MB
      </Text>

      <FlatList
        data={regions}
        keyExtractor={(r) => r.id}
        renderItem={renderRegion}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  storageInfo: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  list: {
    gap: 10,
  },
  regionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  regionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  regionText: {
    flex: 1,
  },
  regionName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  regionSize: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  downloadButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  premiumGate: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  premiumDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  upgradeText: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
});
