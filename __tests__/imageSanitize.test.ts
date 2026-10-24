/**
 * Tests für sanitizeImageForUpload (EXIF/Standort entfernen) und dessen
 * Verwendung in uploadAvatar.
 */

const mockManipulateAsync = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  },
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

// Node-FormData macht aus dem RN-Dateiobjekt einen String; der Stub behält es.
class FormDataStub {
  entries: Record<string, unknown> = {};
  append(key: string, value: unknown) {
    this.entries[key] = value;
  }
}
global.FormData = FormDataStub as unknown as typeof FormData;

import { sanitizeImageForUpload } from '../lib/imageSanitize';
import { uploadAvatar } from '../lib/storage';

beforeEach(() => {
  mockManipulateAsync.mockReset();
  mockManipulateAsync.mockResolvedValue({ uri: 'file:///clean.out', width: 10, height: 10 });
  mockUpload.mockReset();
  mockGetPublicUrl.mockReset();
});

describe('sanitizeImageForUpload', () => {
  it('speichert JPEG neu und gibt die neue URI mit .jpg zurück', async () => {
    const result = await sanitizeImageForUpload({
      uri: 'file:///orig.jpeg',
      name: 'IMG_0001.jpeg',
      type: 'image/jpeg',
    });
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///orig.jpeg', [], {
      compress: 0.9,
      format: 'jpeg',
    });
    expect(result).toEqual({ uri: 'file:///clean.out', name: 'IMG_0001.jpg', type: 'image/jpeg' });
  });

  it.each([
    ['HEIC', { uri: 'file:///a.heic', name: 'urlaub.foto.heic', type: 'image/heic' }, 'urlaub.foto.jpg'],
    ['WebP', { uri: 'file:///b.webp', name: 'b.webp', type: 'image/webp' }, 'b.jpg'],
    ['HEIC ohne type', { uri: 'file:///c.HEIC', name: 'c.HEIC', type: '' }, 'c.jpg'],
  ])('wandelt %s in JPEG um', async (_label, file, expectedName) => {
    const result = await sanitizeImageForUpload(file);
    expect(mockManipulateAsync).toHaveBeenCalledWith(file.uri, [], { compress: 0.9, format: 'jpeg' });
    expect(result).toEqual({ uri: 'file:///clean.out', name: expectedName, type: 'image/jpeg' });
  });

  it('lässt PNG ein PNG', async () => {
    const result = await sanitizeImageForUpload({ uri: 'file:///p.png', name: 'p.png', type: 'image/png' });
    expect(mockManipulateAsync).toHaveBeenCalledWith('file:///p.png', [], { compress: 0.9, format: 'png' });
    expect(result).toEqual({ uri: 'file:///clean.out', name: 'p.png', type: 'image/png' });
  });

  it.each([
    ['GPX', { uri: 'file:///t.gpx', name: 't.gpx', type: 'application/gpx+xml' }],
    ['GPX ohne type', { uri: 'file:///t.gpx', name: 't.gpx', type: '' }],
    ['GIF', { uri: 'file:///g.gif', name: 'g.gif', type: 'image/gif' }],
    ['SVG', { uri: 'file:///s.svg', name: 's.svg', type: 'image/svg+xml' }],
  ])('gibt %s unverändert zurück', async (_label, file) => {
    const result = await sanitizeImageForUpload(file);
    expect(result).toBe(file);
    expect(mockManipulateAsync).not.toHaveBeenCalled();
  });

  it('wirft bei Fehler und weicht nicht auf das Original aus', async () => {
    mockManipulateAsync.mockRejectedValue(new Error('native boom'));
    await expect(
      sanitizeImageForUpload({ uri: 'file:///orig.jpg', name: 'orig.jpg', type: 'image/jpeg' }),
    ).rejects.toThrow('Foto konnte nicht vorbereitet werden.');
  });
});

describe('uploadAvatar', () => {
  it('lädt die bereinigte Datei hoch, Pfad endet auf .jpg', async () => {
    mockUpload.mockImplementation((path: string) => Promise.resolve({ data: { path }, error: null }));
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn/x.jpg' } });

    const result = await uploadAvatar('user-1', {
      uri: 'file:///orig.heic',
      name: 'IMG_0002.heic',
      type: 'image/heic',
    });

    expect(mockUpload).toHaveBeenCalledTimes(1);
    const [path, body, options] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^avatars\/user-1\/avatar_\d+\.jpg$/);
    expect(options).toEqual({ upsert: true, contentType: 'image/jpeg' });
    expect((body as FormDataStub).entries.file).toEqual({ uri: 'file:///clean.out', name: 'IMG_0002.jpg', type: 'image/jpeg' });
    expect(result.path).toBe(path);
  });

  it('lädt nichts hoch, wenn das Bereinigen fehlschlägt', async () => {
    mockManipulateAsync.mockRejectedValue(new Error('native boom'));
    await expect(
      uploadAvatar('user-1', { uri: 'file:///orig.jpg', name: 'orig.jpg', type: 'image/jpeg' }),
    ).rejects.toThrow('Foto konnte nicht vorbereitet werden.');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
