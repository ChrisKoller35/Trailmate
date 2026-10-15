import { Platform } from 'react-native';

// FFmpeg compression for videos before upload
// Uses ffmpeg-kit-react-native (already in package.json)

let FFmpegKit: any = null;

async function getFFmpeg() {
  if (FFmpegKit) return FFmpegKit;
  try {
    const mod = require('ffmpeg-kit-react-native');
    FFmpegKit = mod.FFmpegKit;
    return FFmpegKit;
  } catch {
    console.warn('FFmpeg not available – videos will not be compressed');
    return null;
  }
}

/**
 * Compress a video to 720p, max 15 seconds, H.264/AAC.
 * Returns the compressed file URI, or the original URI if FFmpeg is unavailable.
 */
export async function compressVideo(inputUri: string): Promise<string> {
  const ffmpeg = await getFFmpeg();
  if (!ffmpeg) return inputUri;

  // Generate output path
  const timestamp = Date.now();
  const outputUri = Platform.OS === 'ios'
    ? `${inputUri.substring(0, inputUri.lastIndexOf('/'))}/compressed_${timestamp}.mp4`
    : `file:///data/user/0/com.trailmate/cache/compressed_${timestamp}.mp4`;

  try {
    // Scale to 720p max, limit to 15s, use fast preset for mobile
    const command = `-i "${inputUri}" -vf "scale=-2:720" -t 15 -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 128k -y "${outputUri}"`;

    const session = await ffmpeg.execute(command);
    const returnCode = await session.getReturnCode();

    if (returnCode?.isValueSuccess?.() || returnCode === 0) {
      return outputUri;
    } else {
      console.warn('FFmpeg compression failed, using original');
      return inputUri;
    }
  } catch (err) {
    console.warn('Video compression error:', err);
    return inputUri;
  }
}

/**
 * Get video duration in seconds. Returns null if unavailable.
 */
export async function getVideoDuration(uri: string): Promise<number | null> {
  try {
    const ffmpeg = await getFFmpeg();
    if (!ffmpeg) return null;

    const { FFprobeKit } = require('ffmpeg-kit-react-native');
    const session = await FFprobeKit.getMediaInformation(uri);
    const info = await session.getMediaInformation();
    if (info) {
      const duration = info.getDuration();
      return duration ? parseFloat(duration) : null;
    }
    return null;
  } catch {
    return null;
  }
}
