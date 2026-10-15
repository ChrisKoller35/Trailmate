import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { uploadPostMedia } from '../lib/storage';
import { compressVideo } from '../lib/videoCompression';
import { useAuthStore } from '../stores/authStore';
import { APP_CONFIG } from '../constants';
import { validatePostContent, checkRateLimit } from './useModeration';
import { showErrorToast } from '../lib/toast';
import { usePermissions } from './usePermissions';

interface CreatePostInput {
  content: string;
  mediaAssets: ImagePicker.ImagePickerAsset[];
  routeId?: string | null;
  location?: { latitude: number; longitude: number } | null;
  groupId?: string | null;
  communityId?: string | null;
}

export function useCreatePost() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const { requestMediaLibraryPermission } = usePermissions();

  const pickMedia = useCallback(async () => {
    const granted = await requestMediaLibraryPermission();
    if (!granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: APP_CONFIG.maxMediaPerPost,
      quality: 0.8,
      videoMaxDuration: APP_CONFIG.maxVideoLength,
    });

    if (result.canceled) return null;

    // Validate video constraints
    for (const asset of result.assets) {
      if (asset.type === 'video') {
        if (asset.duration && asset.duration > APP_CONFIG.maxVideoLength * 1000) {
          showErrorToast(`Videos dürfen maximal ${APP_CONFIG.maxVideoLength} Sekunden lang sein.`);
          return null;
        }
        if (asset.fileSize && asset.fileSize > APP_CONFIG.maxVideoSizeMB * 1024 * 1024) {
          showErrorToast(`Videos dürfen maximal ${APP_CONFIG.maxVideoSizeMB} MB gross sein.`);
          return null;
        }
      }
    }

    return result.assets;
  }, [requestMediaLibraryPermission]);

  const createPostMutation = useMutation({
    mutationFn: async (input: CreatePostInput) => {
      if (!userId) {
        showErrorToast('Bitte melde dich an, um einen Beitrag zu erstellen.');
        console.error('[createPost] userId is null – not authenticated');
        return null;
      }
      if (!input.content.trim() && input.mediaAssets.length === 0) {
        showErrorToast('Bitte füge Text oder Medien hinzu.');
        return null;
      }

      // Moderation: Rate limiting
      const rateLimitOk = await checkRateLimit('post', userId);
      if (!rateLimitOk) {
        showErrorToast('Maximal 5 Beiträge pro Stunde erlaubt.');
        return null;
      }

      // Moderation: Content validation (word filter)
      if (input.content.trim()) {
        const validation = validatePostContent(input.content);
        if (validation.status === 'blocked') {
          showErrorToast('Dein Beitrag enthält unzulässige Inhalte.');
          return null;
        }
      }

      setUploadProgress(0);

      // 1. Create post record first (to get ID for media paths)
      const postId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

      // 2. Compress videos & prepare files for upload
      let mediaUrls: { url: string; type: 'image' | 'video'; width?: number; height?: number }[] | null = null;

      if (input.mediaAssets.length > 0) {
        setUploadProgress(10);

        // Compress any videos before upload
        const processedAssets = await Promise.all(
          input.mediaAssets.map(async (asset) => {
            if (asset.type === 'video') {
              const compressedUri = await compressVideo(asset.uri);
              return { ...asset, uri: compressedUri };
            }
            return asset;
          })
        );

        setUploadProgress(30);

        const files = processedAssets.map((asset, i) => {
          const ext = asset.uri.split('.').pop() || (asset.type === 'video' ? 'mp4' : 'jpg');
          return {
            uri: asset.uri,
            name: `${i}_${Date.now()}.${ext}`,
            type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          };
        });

        const uploadResults = await uploadPostMedia(postId, files);
        setUploadProgress(80);

        mediaUrls = uploadResults.map((result, i) => ({
          url: result.publicUrl,
          type: (input.mediaAssets[i].type === 'video' ? 'video' : 'image') as 'image' | 'video',
          width: input.mediaAssets[i].width,
          height: input.mediaAssets[i].height,
        }));
      }

      setUploadProgress(90);

      // 3. Insert post
      const { data, error } = await supabase
        .from('posts')
        .insert({
          id: postId,
          user_id: userId,
          content: input.content.trim() || null,
          media_urls: mediaUrls,
          route_id: input.routeId ?? null,
          location: input.location
            ? `POINT(${input.location.longitude} ${input.location.latitude})`
            : null,
          group_id: input.groupId ?? null,
          community_id: input.communityId ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      setUploadProgress(100);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (err) => {
      console.error('[createPost] failed:', err);
    },
    onSettled: () => {
      setUploadProgress(0);
    },
  });

  const createPost = useCallback(
    (input: CreatePostInput) => createPostMutation.mutateAsync(input),
    [createPostMutation],
  );

  const isSubmitting = createPostMutation.isPending;

  return {
    pickMedia,
    createPost,
    isSubmitting,
    uploadProgress,
  };
}
