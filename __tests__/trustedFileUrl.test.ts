// __tests__/trustedFileUrl.test.ts
// Unit tests for isTrustedStorageUrl.

import { isTrustedStorageUrl } from '../lib/trustedFileUrl';

const SUPABASE = 'https://projekt.supabase.co';
const FILE = `${SUPABASE}/storage/v1/object/public/media/gpx/u1/route.gpx`;

describe('isTrustedStorageUrl', () => {
  it('allows a file in the own public storage', () => {
    expect(isTrustedStorageUrl(FILE, SUPABASE)).toBe(true);
  });

  it('rejects another host', () => {
    expect(
      isTrustedStorageUrl('https://boese.ch/storage/v1/object/public/media/x.gpx', SUPABASE),
    ).toBe(false);
  });

  it('rejects http instead of https', () => {
    expect(isTrustedStorageUrl(FILE.replace('https:', 'http:'), SUPABASE)).toBe(false);
  });

  it('rejects the username trick', () => {
    expect(
      isTrustedStorageUrl(
        'https://projekt.supabase.co@boese.ch/storage/v1/object/public/media/x.gpx',
        SUPABASE,
      ),
    ).toBe(false);
  });

  it('rejects a path outside /storage/v1/object/public/', () => {
    expect(isTrustedStorageUrl(`${SUPABASE}/storage/v1/object/sign/media/x.gpx`, SUPABASE)).toBe(
      false,
    );
    expect(isTrustedStorageUrl(`${SUPABASE}/rest/v1/routes`, SUPABASE)).toBe(false);
  });

  it('rejects an invalid url', () => {
    expect(isTrustedStorageUrl('keine adresse', SUPABASE)).toBe(false);
  });

  it('rejects when the Supabase url is missing', () => {
    expect(isTrustedStorageUrl(FILE, undefined)).toBe(false);
    expect(isTrustedStorageUrl(FILE, '')).toBe(false);
  });
});
