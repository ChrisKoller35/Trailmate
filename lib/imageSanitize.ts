export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'];
// GIF (Animation) und SVG (Vektor) lassen sich nicht sinnvoll als JPEG/PNG neu speichern.
const PASSTHROUGH_TYPES = ['image/gif', 'image/svg+xml'];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function isSanitizableImage(file: UploadFile): boolean {
  const type = file.type.toLowerCase();
  if (type) return type.startsWith('image/') && !PASSTHROUGH_TYPES.includes(type);
  return IMAGE_EXTENSIONS.includes(extensionOf(file.name));
}

function isPng(file: UploadFile): boolean {
  const type = file.type.toLowerCase();
  return type ? type === 'image/png' : extensionOf(file.name) === 'png';
}

/**
 * Speichert ein Bild neu, damit keine EXIF-Daten (v. a. GPS-Standort) mitgehen.
 * Nicht-Bilder, GIF und SVG kommen unverändert zurück. Schlägt das Neuspeichern
 * fehl, wird ein Fehler geworfen – nie auf die Originaldatei ausweichen.
 */
export async function sanitizeImageForUpload(file: UploadFile): Promise<UploadFile> {
  if (!isSanitizableImage(file)) return file;

  const png = isPng(file);
  try {
    const IM = await import('expo-image-manipulator');
    const result = await IM.manipulateAsync(file.uri, [], {
      compress: 0.9,
      format: png ? IM.SaveFormat.PNG : IM.SaveFormat.JPEG,
    });
    return {
      uri: result.uri,
      name: `${baseName(file.name)}.${png ? 'png' : 'jpg'}`,
      type: png ? 'image/png' : 'image/jpeg',
    };
  } catch (err) {
    throw new Error('Foto konnte nicht vorbereitet werden.', { cause: err });
  }
}
