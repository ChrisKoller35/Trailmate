/**
 * Central MapLibre import — ensures the native module is loaded exactly once.
 * Every file that needs MapLibre components MUST import from here instead of
 * importing from '@maplibre/maplibre-react-native' directly.
 */
import { Platform } from 'react-native';

let MapView: any = null;
let Camera: any = null;
let UserLocation: any = null;
let ShapeSource: any = null;
let LineLayer: any = null;
let PointAnnotation: any = null;
let RasterSource: any = null;
let RasterLayer: any = null;
let OfflineManager: any = null;
let setAccessToken: (token: string | null) => void = () => {};
let mapLibreAvailable = false;
let mapLibreError = '';

if (Platform.OS !== 'web') {
  try {
    const ML = require('@maplibre/maplibre-react-native');
    MapView = ML.MapView;
    Camera = ML.Camera;
    UserLocation = ML.UserLocation;
    ShapeSource = ML.ShapeSource;
    LineLayer = ML.LineLayer;
    PointAnnotation = ML.PointAnnotation;
    RasterSource = ML.RasterSource;
    RasterLayer = ML.RasterLayer;
    OfflineManager = ML.OfflineManager;
    setAccessToken = ML.setAccessToken ?? (() => {});
    setAccessToken(null);
    mapLibreAvailable = true;
  } catch (e: any) {
    mapLibreError = e?.message ?? 'MapLibre konnte nicht geladen werden';
  }
}

export {
  MapView,
  Camera,
  UserLocation,
  ShapeSource,
  LineLayer,
  PointAnnotation,
  RasterSource,
  RasterLayer,
  OfflineManager,
  setAccessToken,
  mapLibreAvailable,
  mapLibreError,
};
