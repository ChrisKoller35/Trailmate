import {
  correctTemperature,
  idwInterpolate,
  interpolateForecasts,
  yrNoModelElevation,
  type StationForecast,
} from '../supabase/functions/_shared/weatherMath';

function row(overrides: Partial<StationForecast>): StationForecast {
  return {
    station_id: 'A',
    station_elevation_m: 600,
    dist_m: 1000,
    forecast_time: '2026-10-17T10:00:00Z',
    temperature: 10,
    precipitation: 0,
    wind_speed: 2,
    cloud_cover: 50,
    weather_symbol_code: 'cloudy',
    source: 'yrno',
    ...overrides,
  };
}

// ─── idwInterpolate ──────────────────────────────────────────────────────────

describe('idwInterpolate', () => {
  it('weights two stations at 1 km and 3 km with 1/d', () => {
    // weights 1/1000 and 1/3000 → (10·3 + 6·1) / 4 = 9
    expect(
      idwInterpolate([
        { value: 10, distance: 1000 },
        { value: 6, distance: 3000 },
      ]),
    ).toBeCloseTo(9);
  });

  it('returns null instead of 0 when no station has a value', () => {
    expect(idwInterpolate([])).toBeNull();
    expect(idwInterpolate([{ value: null, distance: 500 }])).toBeNull();
  });

  it('keeps a station that sits exactly on the point', () => {
    expect(
      idwInterpolate([
        { value: 4, distance: 0 },
        { value: 20, distance: 2000 },
      ]),
    ).toBe(4);
  });
});

// ─── interpolateForecasts ────────────────────────────────────────────────────

describe('interpolateForecasts', () => {
  it('reads dist_m from get_nearest_weather and returns real temperatures', () => {
    const result = interpolateForecasts([
      row({ station_id: 'A', dist_m: 1000, temperature: 10, station_elevation_m: 600 }),
      row({ station_id: 'B', dist_m: 3000, temperature: 6, station_elevation_m: 1000 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].temperature).toBe(9);
    expect(result[0].station_elevation_m).toBe(700);
    expect(result[0].source).toBe('yrno');
  });

  it('groups by time, sorts ascending and takes the symbol from the nearest station', () => {
    const result = interpolateForecasts([
      row({ forecast_time: '2026-10-17T11:00:00Z', dist_m: 4000, weather_symbol_code: 'rain' }),
      row({ forecast_time: '2026-10-17T10:00:00Z', dist_m: 4000, weather_symbol_code: 'rain' }),
      row({
        forecast_time: '2026-10-17T10:00:00Z',
        dist_m: 800,
        weather_symbol_code: 'clearsky_day',
      }),
    ]);

    expect(result.map((r) => r.forecast_time)).toEqual([
      '2026-10-17T10:00:00Z',
      '2026-10-17T11:00:00Z',
    ]);
    expect(result[0].weather_symbol_code).toBe('clearsky_day');
  });

  it('keeps missing values as null', () => {
    const [forecast] = interpolateForecasts([row({ temperature: null, wind_speed: null })]);
    expect(forecast.temperature).toBeNull();
    expect(forecast.wind_speed).toBeNull();
  });
});

// ─── correctTemperature ──────────────────────────────────────────────────────

describe('correctTemperature', () => {
  it('corrects from a 600 m station to a 2100 m route', () => {
    expect(correctTemperature(22, 600, 2100)).toBe(13);
  });

  it('leaves the temperature unchanged without a known station elevation', () => {
    expect(correctTemperature(22, 0, 2100)).toBe(22);
    expect(correctTemperature(22, null, 2100)).toBe(22);
  });
});

// ─── yrNoModelElevation ──────────────────────────────────────────────────────

describe('yrNoModelElevation', () => {
  it('reads the altitude from the GeoJSON coordinates', () => {
    expect(yrNoModelElevation({ geometry: { coordinates: [8.04, 46.62, 1876] } })).toBe(1876);
  });

  it('returns 0 when the altitude is missing', () => {
    expect(yrNoModelElevation({ geometry: { coordinates: [8.04, 46.62] } })).toBe(0);
    expect(yrNoModelElevation({})).toBe(0);
  });
});
