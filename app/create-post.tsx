import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// Lazy-loaded to avoid crash when native module isn't available
let _ImageManipulator: typeof import('expo-image-manipulator') | null = null;
async function getImageManipulator() {
  if (!_ImageManipulator) {
    _ImageManipulator = await import('expo-image-manipulator');
  }
  return _ImageManipulator;
}
import * as Location from 'expo-location';
import { Colors, APP_CONFIG } from '../constants';
import { usePermissions } from '../hooks/usePermissions';
import { useCreatePost } from '../hooks/useCreatePost';
import ImageCropModal from '../components/ImageCropModal';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { showErrorToast } from '../lib/toast';
import { parseCreatePostParams } from '../lib/createPostParams';
import type { Route } from '../types';

type SelectedRoute = Pick<Route, 'id' | 'title' | 'distance_m' | 'elevation_gain_m' | 'sac_scale'>;

function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function errorMessage(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
}

export default function CreatePostScreen() {
  const { createPost, pickMedia, isSubmitting, uploadProgress } = useCreatePost();
  const { requestLocationPermission } = usePermissions();
  const rawParams = useLocalSearchParams();
  const { text: paramText, routeId: paramRouteId, groupId, communityId } =
    parseCreatePostParams(rawParams);

  const [content, setContent] = useState('');
  const [mediaAssets, setMediaAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<SelectedRoute | null>(null);
  const [showRoutePicker, setShowRoutePicker] = useState(false);
  const [postLocation, setPostLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<'original' | '4:3' | '16:9'>('original');
  const [cropModalIndex, setCropModalIndex] = useState<number | null>(null);
  const [targetName, setTargetName] = useState<string | null>(null);

  // Vorbereiteten Text nur einmal übernehmen, danach ist das Feld frei editierbar.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !paramText) return;
    prefilled.current = true;
    setContent(paramText);
  }, [paramText]);

  useEffect(() => {
    if (!paramRouteId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('routes')
        .select('id, title, distance_m, elevation_gain_m, sac_scale')
        .eq('id', paramRouteId)
        .maybeSingle();
      if (!cancelled && data) setSelectedRoute(data as SelectedRoute);
    })();
    return () => { cancelled = true; };
  }, [paramRouteId]);

  useEffect(() => {
    const table = groupId ? 'groups' : communityId ? 'communities' : null;
    const id = groupId ?? communityId;
    if (!table || !id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from(table).select('name').eq('id', id).maybeSingle();
      if (!cancelled) setTargetName((data as { name: string } | null)?.name ?? null);
    })();
    return () => { cancelled = true; };
  }, [groupId, communityId]);

  const ASPECT_RATIOS: { key: typeof aspectRatio; label: string; value: number | null; aspect: [number, number] | undefined }[] = [
    { key: 'original', label: 'Original', value: null, aspect: undefined },
    { key: '4:3',      label: '4:3',      value: 3 / 4, aspect: [4, 3] },
    { key: '16:9',     label: '16:9',     value: 9 / 16, aspect: [16, 9] },
  ];

  const previewWidth = SCREEN_WIDTH - 32;
  const currentAsset = mediaAssets[previewIndex];
  const previewHeight = (() => {
    const ratio = ASPECT_RATIOS.find(r => r.key === aspectRatio);
    if (ratio?.value) return previewWidth * ratio.value;
    if (currentAsset?.width && currentAsset?.height) {
      return Math.min(previewWidth * (currentAsset.height / currentAsset.width), 420);
    }
    return previewWidth * 0.75;
  })();

  const openCropModal = (index: number) => {
    const asset = mediaAssets[index];
    if (!asset || asset.type === 'video') return;
    setCropModalIndex(index);
  };

  const applyCrop = async (crop: { originX: number; originY: number; width: number; height: number }) => {
    if (cropModalIndex === null) return;
    const asset = mediaAssets[cropModalIndex];
    setCropModalIndex(null);
    if (!asset) return;
    const IM = await getImageManipulator();
    const result = await IM.manipulateAsync(
      asset.uri,
      [{ crop }],
      { compress: 0.85, format: IM.SaveFormat.JPEG },
    );
    setMediaAssets(prev =>
      prev.map((a, i) =>
        i === cropModalIndex ? { ...a, uri: result.uri, width: result.width, height: result.height } : a,
      ),
    );
  };

  const handlePickMedia = async () => {
    const assets = await pickMedia();
    if (assets) {
      const total = mediaAssets.length + assets.length;
      if (total > APP_CONFIG.maxMediaPerPost) {
        showErrorToast(`Maximal ${APP_CONFIG.maxMediaPerPost} Dateien pro Post erlaubt.`);
        return;
      }
      setMediaAssets((prev) => [...prev, ...assets]);
    }
  };


  const handleAddLocation = async () => {
    if (postLocation) {
      setPostLocation(null);
      setLocationName(null);
      return;
    }

    setIsLoadingLocation(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPostLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

      // Reverse geocode for display name
      try {
        const [result] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (result) {
          const parts = [result.city || result.subregion, result.region].filter(Boolean);
          setLocationName(parts.join(', ') || 'Standort hinzugefügt');
        }
      } catch {
        setLocationName('Standort hinzugefügt');
      }
    } catch {
      showErrorToast('Standort konnte nicht ermittelt werden.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const result = await createPost({
        content,
        mediaAssets,
        routeId: selectedRoute?.id ?? null,
        location: postLocation,
        groupId,
        communityId,
      });
      if (result) {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      if (errorCode(err) === '42501' && (groupId || communityId)) {
        showErrorToast(
          groupId
            ? 'Du bist kein Mitglied dieser Gruppe'
            : 'Du bist kein Mitglied dieser Community',
        );
        return;
      }
      showErrorToast(errorMessage(err) ?? 'Beitrag konnte nicht erstellt werden.');
    }
  };

  const canSubmit = content.trim().length > 0 || mediaAssets.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/explore')} hitSlop={12}>
          <Ionicons name="close" size={26} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Neuer Beitrag</Text>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          style={[styles.postButton, (!canSubmit || isSubmitting) && styles.postButtonDisabled]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={Colors.surface} />
          ) : (
            <Text style={styles.postButtonText}>Posten</Text>
          )}
        </Pressable>
      </View>

      {/* Upload Progress */}
      {isSubmitting && uploadProgress > 0 && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Ziel: Gruppe oder Community */}
        {(groupId || communityId) && (
          <View style={styles.targetBanner}>
            <Ionicons
              name={groupId ? 'people-outline' : 'globe-outline'}
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.targetText} numberOfLines={1}>
              {groupId ? 'Beitrag in der Gruppe ' : 'Beitrag in der Community '}
              {targetName ?? '…'}
            </Text>
          </View>
        )}

        {/* Text input */}
        <TextInput
          style={styles.textInput}
          placeholder="Was hast du erlebt? Erzähle von deiner Tour..."
          placeholderTextColor={Colors.textLight}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={2000}
          autoFocus
        />

        {/* Media preview */}
        {mediaAssets.length > 0 && (
          <View style={styles.mediaPreviewBlock}>
            {/* Large preview */}
            <View style={[styles.mediaPreviewCard, { height: previewHeight }]}>
              <Image
                source={{ uri: currentAsset?.uri }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                resizeMode="cover"
              />
              {currentAsset?.type === 'video' && (
                <View style={styles.videoOverlay}>
                  <Ionicons name="play-circle" size={44} color="#fff" />
                </View>
              )}
              {/* Remove button */}
              <Pressable style={styles.removeMediaButton} onPress={() => {
                const next = mediaAssets.filter((_, i) => i !== previewIndex);
                setMediaAssets(next);
                setPreviewIndex(Math.min(previewIndex, next.length - 1));
              }}>
                <Ionicons name="close-circle" size={26} color="#fff" />
              </Pressable>
              {/* Crop button */}
              <Pressable style={styles.cropButton} onPress={() => openCropModal(previewIndex)}>
                <Ionicons name="crop-outline" size={18} color="#fff" />
                <Text style={styles.cropButtonText}>Zuschneiden</Text>
              </Pressable>
              {/* Navigation arrows */}
              {mediaAssets.length > 1 && (
                <>
                  {previewIndex > 0 && (
                    <Pressable style={[styles.navArrow, styles.navArrowLeft]} onPress={() => setPreviewIndex(i => i - 1)}>
                      <Ionicons name="chevron-back" size={22} color="#fff" />
                    </Pressable>
                  )}
                  {previewIndex < mediaAssets.length - 1 && (
                    <Pressable style={[styles.navArrow, styles.navArrowRight]} onPress={() => setPreviewIndex(i => i + 1)}>
                      <Ionicons name="chevron-forward" size={22} color="#fff" />
                    </Pressable>
                  )}
                </>
              )}
            </View>

            {/* Dot indicators + thumbnail strip */}
            {mediaAssets.length > 1 && (
              <View style={styles.thumbnailRow}>
                {mediaAssets.map((asset, index) => (
                  <Pressable key={index} onPress={() => setPreviewIndex(index)}>
                    <Image
                      source={{ uri: asset.uri }}
                      style={[styles.thumbnail, index === previewIndex && styles.thumbnailActive]}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Aspect ratio selector */}
            <View style={styles.ratioRow}>
              {ASPECT_RATIOS.map(r => (
                <Pressable
                  key={r.key}
                  style={[styles.ratioBtn, aspectRatio === r.key && styles.ratioBtnActive]}
                  onPress={() => setAspectRatio(r.key)}
                >
                  <Text style={[styles.ratioBtnText, aspectRatio === r.key && styles.ratioBtnTextActive]}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Route preview */}
        {selectedRoute && (
          <View style={styles.routePreview}>
            <Ionicons name="map-outline" size={20} color={Colors.primary} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeTitle} numberOfLines={1}>
                {selectedRoute.title ?? 'Route'}
              </Text>
              <Text style={styles.routeStats}>
                {selectedRoute.distance_m
                  ? `${(selectedRoute.distance_m / 1000).toFixed(1)} km`
                  : '–'}
                {selectedRoute.elevation_gain_m
                  ? ` | ↑${Math.round(selectedRoute.elevation_gain_m)}m`
                  : ''}
                {selectedRoute.sac_scale ? ` | ${selectedRoute.sac_scale}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedRoute(null)}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={20} color={Colors.textLight} />
            </Pressable>
          </View>
        )}

        {/* Location */}
        {postLocation && locationName && (
          <View style={styles.locationPreview}>
            <Ionicons name="location" size={18} color={Colors.primary} />
            <Text style={styles.locationText}>{locationName}</Text>
            <Pressable onPress={() => { setPostLocation(null); setLocationName(null); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.textLight} />
            </Pressable>
          </View>
        )}

        {/* Action row */}
        <View style={styles.actionRow}>
          <Pressable style={styles.actionItem} onPress={handlePickMedia}>
            <Ionicons name="images-outline" size={22} color={Colors.primary} />
            <Text style={styles.actionItemText}>
              Fotos/Videos ({mediaAssets.length}/{APP_CONFIG.maxMediaPerPost})
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionItem}
            onPress={() => setShowRoutePicker(true)}
          >
            <Ionicons name="map-outline" size={22} color={Colors.primary} />
            <Text style={styles.actionItemText}>Route verknüpfen</Text>
          </Pressable>

          <Pressable
            style={styles.actionItem}
            onPress={handleAddLocation}
            disabled={isLoadingLocation}
          >
            <Ionicons
              name={postLocation ? 'location' : 'location-outline'}
              size={22}
              color={postLocation ? Colors.success : Colors.primary}
            />
            <Text style={styles.actionItemText}>
              {isLoadingLocation ? 'Standort wird ermittelt...' : postLocation ? 'Standort entfernen' : 'Standort hinzufügen'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Crop Modal */}
      {cropModalIndex !== null && currentAsset && (
        <ImageCropModal
          visible
          uri={currentAsset.uri}
          originalWidth={currentAsset.width ?? 1080}
          originalHeight={currentAsset.height ?? 1080}
          fixedRatio={(() => {
            const r = ASPECT_RATIOS.find(r => r.key === aspectRatio);
            return r?.value ? 1 / r.value : null;
          })()}
          onConfirm={applyCrop}
          onCancel={() => setCropModalIndex(null)}
        />
      )}

      {/* Route Picker Modal (simplified inline) */}
      {showRoutePicker && (
        <RoutePickerSheet
          onSelect={(route) => {
            setSelectedRoute(route);
            setShowRoutePicker(false);
          }}
          onClose={() => setShowRoutePicker(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Route Picker (simplified) ──────────────────────────────

function RoutePickerSheet({
  onSelect,
  onClose,
}: {
  onSelect: (route: Route) => void;
  onClose: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    if (!userId) return;
    (async () => {
      // Fetch user's recorded routes + bookmarked routes
      const { data: recordings } = await supabase
        .from('recordings')
        .select('route_id')
        .eq('user_id', userId)
        .not('route_id', 'is', null);

      const routeIds = recordings?.map((r) => r.route_id).filter(Boolean) ?? [];

      if (routeIds.length > 0) {
        const { data } = await supabase
          .from('routes')
          .select('*')
          .in('id', routeIds)
          .order('created_at', { ascending: false })
          .limit(20);
        setRoutes((data as Route[]) ?? []);
      }
      setIsLoading(false);
    })();
  }, [userId]);

  return (
    <View style={pickerStyles.overlay}>
      <View style={pickerStyles.sheet}>
        <View style={pickerStyles.header}>
          <Text style={pickerStyles.title}>Route auswählen</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ padding: 40 }} />
        ) : routes.length === 0 ? (
          <View style={pickerStyles.empty}>
            <Ionicons name="trail-sign-outline" size={40} color={Colors.textLight} />
            <Text style={pickerStyles.emptyText}>Keine Routen vorhanden</Text>
          </View>
        ) : (
          <ScrollView style={pickerStyles.list}>
            {routes.map((route) => (
              <Pressable
                key={route.id}
                style={pickerStyles.routeItem}
                onPress={() => onSelect(route)}
              >
                <View>
                  <Text style={pickerStyles.routeTitle} numberOfLines={1}>
                    {route.title ?? 'Route'}
                  </Text>
                  <Text style={pickerStyles.routeStats}>
                    {route.distance_m ? `${(route.distance_m / 1000).toFixed(1)} km` : '–'}
                    {route.elevation_gain_m ? ` | ↑${Math.round(route.elevation_gain_m)}m` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  postButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
  postButtonText: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  progressBar: {
    height: 3,
    backgroundColor: Colors.borderLight,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 10,
  },
  targetText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  textInput: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  mediaPreviewBlock: {
    marginTop: 12,
    marginHorizontal: 16,
    gap: 10,
  },
  mediaPreviewCard: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceVariant,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 13,
  },
  cropButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cropButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  navArrowLeft: { left: 8 },
  navArrowRight: { right: 8 },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
    opacity: 0.6,
  },
  thumbnailActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  ratioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratioBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  ratioBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceVariant,
  },
  ratioBtnText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  ratioBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  routePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 12,
    gap: 10,
  },
  routeInfo: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  routeStats: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 10,
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  actionRow: {
    marginTop: 20,
    marginHorizontal: 16,
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  actionItemText: {
    fontSize: 15,
    color: Colors.text,
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  list: {
    padding: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceVariant,
    marginBottom: 8,
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  routeStats: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
