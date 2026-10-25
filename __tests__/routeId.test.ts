// __tests__/routeId.test.ts
// Unit tests for normalizeRouteId (lib/routeId).

import { normalizeRouteId } from '../lib/routeId';

const UUID = '3f2b8c1e-5d4a-4e7b-9c0d-1a2b3c4d5e6f';

describe('normalizeRouteId', () => {
  it('returns a UUID unchanged', () => {
    expect(normalizeRouteId(UUID)).toBe(UUID);
    expect(normalizeRouteId(UUID.toUpperCase())).toBe(UUID.toUpperCase());
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeRouteId(` ${UUID} `)).toBe(UUID);
  });

  it('takes the first element of an array', () => {
    expect(normalizeRouteId([UUID, 'demo-1'])).toBe(UUID);
    expect(normalizeRouteId(['demo-1', UUID])).toBeNull();
    expect(normalizeRouteId([])).toBeNull();
  });

  it('rejects everything that is not a UUID', () => {
    expect(normalizeRouteId('demo-1')).toBeNull();
    expect(normalizeRouteId('')).toBeNull();
    expect(normalizeRouteId(undefined)).toBeNull();
    expect(normalizeRouteId(null)).toBeNull();
    expect(normalizeRouteId(42)).toBeNull();
    expect(normalizeRouteId(`${UUID}x`)).toBeNull();
  });
});
