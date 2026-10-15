export const Colors = {
  primary: '#2D6A4F',
  primaryLight: '#52B788',
  primaryDark: '#1B4332',
  secondary: '#D4A373',
  secondaryLight: '#E9C46A',
  accent: '#F4845F',
  background: '#FAFAF5',
  surface: '#FFFFFF',
  surfaceVariant: '#F0F2EB',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  textOnPrimary: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  error: '#DC2626',
  warning: '#F59E0B',
  success: '#16A34A',
  info: '#3B82F6',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  tabBarActive: '#2D6A4F',
  tabBarInactive: '#9CA3AF',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export const SAC_SCALES = {
  T1: { label: 'T1 – Wandern', color: '#FBBF24' },
  T2: { label: 'T2 – Bergwandern', color: '#F59E0B' },
  T3: { label: 'T3 – Anspruchsvolles Bergwandern', color: '#EF4444' },
  T4: { label: 'T4 – Alpinwandern', color: '#DC2626' },
  T5: { label: 'T5 – Anspruchsvolles Alpinwandern', color: '#7C3AED' },
  T6: { label: 'T6 – Schwieriges Alpinwandern', color: '#4C1D95' },
} as const;

export const APP_CONFIG = {
  apiTimeout: 15000,
  maxMediaPerPost: 10,
  maxVideoLength: 15,
  maxVideoSizeMB: 20,
  maxBioLength: 150,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retryCount: 2,
} as const;

export const REGIONS = [
  'Berner Oberland',
  'Wallis',
  'Graubünden / Engadin',
  'Zentralschweiz',
  'Ostschweiz',
  'Tessin',
  'Jura',
  'Zürich & Umgebung',
  'Basel & Umgebung',
  'Emmental',
  'Fribourg / Freiburg',
] as const;

export const HIKING_LEVELS: { value: import('../types').HikingLevel; label: string; emoji: string; desc: string }[] = [
  { value: 'T1-T2', emoji: '🟢', label: 'Einsteiger', desc: 'T1–T2: Wanderwege & leichte Bergwege' },
  { value: 'T3', emoji: '🟡', label: 'Fortgeschritten', desc: 'T3: Anspruchsvolles Bergwandern' },
  { value: 'T4-T6', emoji: '🔴', label: 'Alpin', desc: 'T4–T6: Alpinwandern & schwieriges Gelände' },
];

export const TRAIL_CONDITIONS = [
  { key: 'trail_open', label: 'Weg offen und gut begehbar', emoji: '✅' },
  { key: 'snow_fields', label: 'Schneefelder vorhanden', emoji: '❄️' },
  { key: 'wet_slippery', label: 'Weg nass/rutschig', emoji: '💧' },
  { key: 'rockfall_danger', label: 'Steinschlaggefahr', emoji: '⚠️' },
  { key: 'partially_closed', label: 'Weg teilweise gesperrt', emoji: '🚫' },
  { key: 'bridge_damaged', label: 'Brücke/Steg beschädigt', emoji: '🌉' },
] as const;

export const WEATHER_SYMBOLS: Record<string, { label: string; icon: string }> = {
  clearsky: { label: 'Sonnig', icon: 'sunny' },
  fair: { label: 'Leicht bewölkt', icon: 'partly-sunny' },
  partlycloudy: { label: 'Teilweise bewölkt', icon: 'partly-sunny' },
  cloudy: { label: 'Bewölkt', icon: 'cloudy' },
  rain: { label: 'Regen', icon: 'rainy' },
  lightrain: { label: 'Leichter Regen', icon: 'rainy' },
  heavyrain: { label: 'Starker Regen', icon: 'rainy' },
  snow: { label: 'Schnee', icon: 'snow' },
  lightsnow: { label: 'Leichter Schneefall', icon: 'snow' },
  heavysnow: { label: 'Starker Schneefall', icon: 'snow' },
  thunder: { label: 'Gewitter', icon: 'thunderstorm' },
  fog: { label: 'Nebel', icon: 'cloudy' },
};

export const BADGE_CATEGORIES = [
  { key: 'summits', label: 'Gipfel & Routen', emoji: '🏔️' },
  { key: 'sports', label: 'Sportliche Leistungen', emoji: '📏' },
  { key: 'social', label: 'Soziale Abzeichen', emoji: '👥' },
  { key: 'fun', label: 'Fun & Hütten', emoji: '☕' },
  { key: 'weather', label: 'Wetter & Jahreszeiten', emoji: '🌦️' },
  { key: 'activity', label: 'Aktivität', emoji: '⏰' },
  { key: 'special', label: 'Spezial', emoji: '⭐' },
] as const;

export const RARITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  rare: 'Selten',
  epic: 'Episch',
};

export const RARITY_COLORS: Record<string, string> = {
  normal: '#6B7280',
  rare: '#3B82F6',
  epic: '#7C3AED',
};

export const ROUTES = {
  TABS: '(tabs)',
  AUTH: '(auth)',
  ONBOARDING: '(onboarding)',
  FEED: '(tabs)/index',
  MAP: '(tabs)/map',
  RECORD: '(tabs)/record',
  EXPLORE: '(tabs)/explore',
  PROFILE: '(tabs)/profile',
  LOGIN: '(auth)/login',
  REGISTER: '(auth)/register',
} as const;
