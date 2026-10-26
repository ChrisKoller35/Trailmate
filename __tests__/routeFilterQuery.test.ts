// __tests__/routeFilterQuery.test.ts
// Unit tests for applyRouteFilters / hasActiveRouteFilters and the min/max
// clamping in useRouteFilterStore.

import {
  applyRouteFilters,
  DEFAULT_ROUTE_FILTERS,
  hasActiveRouteFilters,
  type RouteFilterBuilder,
  type RouteFilterValues,
} from '../lib/routeFilterQuery';
import { useRouteFilterStore } from '../hooks/useRouteFilter';
import type { SACScale } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../lib/supabase', () => ({ supabase: {} }));

type Call = [string, ...unknown[]];

function makeBuilder() {
  const calls: Call[] = [];
  const builder: RouteFilterBuilder = {
    or: (filters: string) => (calls.push(['or', filters]), builder),
    gte: (column: string, value: number) => (calls.push(['gte', column, value]), builder),
    lte: (column: string, value: number) => (calls.push(['lte', column, value]), builder),
    in: (column: string, values: readonly SACScale[]) => (
      calls.push(['in', column, values]), builder
    ),
  };
  return { builder, calls };
}

function run(overrides: Partial<RouteFilterValues>): Call[] {
  const { builder, calls } = makeBuilder();
  applyRouteFilters(builder, { ...DEFAULT_ROUTE_FILTERS, ...overrides });
  return calls;
}

describe('applyRouteFilters', () => {
  it('setzt mit Standardwerten nur den or-Filter für veröffentlichte und kuratierte Routen', () => {
    expect(run({})).toEqual([['or', 'is_published.eq.true,is_curated.eq.true']]);
  });

  it('übersetzt Mindest- und Maximalwerte in Meter und Minuten', () => {
    expect(run({ minDistance: 5 })).toContainEqual(['gte', 'distance_m', 5000]);
    expect(run({ maxDuration: 2 })).toContainEqual(['lte', 'estimated_duration_min', 120]);
    expect(run({ maxHeight: 3000 })).toContainEqual(['lte', 'max_elevation_m', 3000]);
  });

  it('filtert SAC-Grade über in', () => {
    expect(run({ sacScales: ['T1', 'T2'] })).toContainEqual(['in', 'sac_scale', ['T1', 'T2']]);
  });
});

describe('hasActiveRouteFilters', () => {
  it('ist für die Standardwerte false und nach einer Änderung true', () => {
    expect(hasActiveRouteFilters(DEFAULT_ROUTE_FILTERS)).toBe(false);
    expect(hasActiveRouteFilters({ ...DEFAULT_ROUTE_FILTERS, minElevation: 100 })).toBe(true);
  });
});

describe('useRouteFilterStore', () => {
  beforeEach(() => useRouteFilterStore.getState().resetFilters());

  it('begrenzt min auf max und max auf min', () => {
    const store = useRouteFilterStore.getState();
    store.setMaxDistance(10);
    store.setMinDistance(20);
    expect(useRouteFilterStore.getState().minDistance).toBe(10);
    store.setMaxDistance(5);
    expect(useRouteFilterStore.getState().maxDistance).toBe(10);
  });
});
