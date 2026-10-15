import { Platform } from 'react-native';
import { supabase } from './supabase';

const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL!;

interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

interface UploadResult {
  path: string;
  publicUrl: string;
}

// Upload to Supabase Storage (works on both web and mobile)
async function uploadFile(
  bucket: string,
  path: string,
  file: UploadFile
): Promise<UploadResult> {
  let body: Blob | FormData;

  if (Platform.OS === 'web') {
    // Web: convert URI (blob: or data: or http:) to actual Blob
    const resp = await fetch(file.uri);
    const blob = await resp.blob();
    // Re-wrap with correct MIME type if needed
    body = new Blob([blob], { type: file.type || blob.type });
  } else {
    // React Native: use FormData with file URI (RN-specific pattern)
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    body = formData;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, body, {
      upsert: true,
      contentType: file.type,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, publicUrl: urlData.publicUrl };
}

export async function uploadAvatar(
  userId: string,
  file: UploadFile
): Promise<UploadResult> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `avatars/${userId}/avatar_${Date.now()}.${ext}`;
  return uploadFile('media', path, file);
}

export async function uploadCoverImage(
  userId: string,
  file: UploadFile
): Promise<UploadResult> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `covers/${userId}/cover_${Date.now()}.${ext}`;
  return uploadFile('media', path, file);
}

export async function uploadPostMedia(
  postId: string,
  files: UploadFile[]
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `posts/${postId}/${i}_${Date.now()}.${ext}`;
    const result = await uploadFile('media', path, file);
    results.push(result);
  }
  return results;
}

export async function uploadGPX(
  recordingId: string,
  file: UploadFile
): Promise<UploadResult> {
  const path = `gpx/${recordingId}/track_${Date.now()}.gpx`;
  return uploadFile('media', path, file);
}

export async function uploadTrailConditionPhoto(
  reportId: string,
  files: UploadFile[]
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `trail-conditions/${reportId}/${i}_${Date.now()}.${ext}`;
    const result = await uploadFile('media', path, file);
    results.push(result);
  }
  return results;
}

export function getPublicUrl(path: string): string {
  // Strip leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${R2_PUBLIC_URL}/${cleanPath}`;
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from('media').remove([path]);
  if (error) throw error;
}
