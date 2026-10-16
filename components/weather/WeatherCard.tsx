import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants';
import { useWeather } from '../../hooks/useWeather';
import { getWeatherIcon } from './WeatherIcons';

interface WeatherCardProps {
  routeId: string;
  lat: number;
  lng: number;
  elevation?: number;
}

type TabMode = 'hourly' | 'daily';

export default function WeatherCard({
  routeId,
  lat,
  lng,
  elevation,
}: WeatherCardProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('hourly');
  const {
    hourlyForecasts,
    dailyForecasts,
    warnings,
    isLoading,
    error,
    lastUpdated,
    source,
  } = useWeather(routeId, lat, lng, elevation);

  // ─── Current conditions (first hourly forecast) ────────
  const current = hourlyForecasts[0];
  const CurrentIcon = current
    ? getWeatherIcon(current.weather_symbol_code)
    : null;

  if (isLoading && hourlyForecasts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Wetter wird geladen…</Text>
        </View>
      </View>
    );
  }

  if (error && hourlyForecasts.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Warning Banner */}
      {warnings.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            {warnings.map((w) => w.message).join(' · ')}
          </Text>
        </View>
      )}

      {/* Current Weather Summary */}
      {current && (
        <View style={styles.currentWeather}>
          {/* getWeatherIcon liefert stabile, modulweite Komponenten – nichts wird beim Rendern neu erzeugt */}
          {/* eslint-disable-next-line react-hooks/static-components */}
          {CurrentIcon && <CurrentIcon size={48} />}
          <View style={styles.currentInfo}>
            <Text style={styles.currentTemp}>
              {current.temperature !== null
                ? `${Math.round(current.temperature)}°C`
                : '—'}
            </Text>
            <Text style={styles.currentDetails}>
              {current.wind_speed !== null
                ? `Wind ${Math.round(current.wind_speed * 3.6)} km/h`
                : ''}
              {current.precipitation !== null && current.precipitation > 0
                ? `  ·  ${current.precipitation} mm`
                : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'hourly' && styles.tabActive]}
          onPress={() => setActiveTab('hourly')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'hourly' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'hourly' && styles.tabTextActive,
            ]}
          >
            Stündlich
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'daily' && styles.tabActive]}
          onPress={() => setActiveTab('daily')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'daily' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'daily' && styles.tabTextActive,
            ]}
          >
            Täglich
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hourly View */}
      {activeTab === 'hourly' && (
        <FlatList
          horizontal
          data={hourlyForecasts}
          keyExtractor={(item) => item.time}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hourlyList}
          renderItem={({ item }) => {
            const Icon = getWeatherIcon(item.weather_symbol_code);
            return (
              <View style={styles.hourlyItem}>
                <Text style={styles.hourlyTime}>{item.label}</Text>
                <Icon size={28} />
                <Text style={styles.hourlyTemp}>
                  {item.temperature !== null
                    ? `${Math.round(item.temperature)}°`
                    : '—'}
                </Text>
                {item.wind_speed !== null && (
                  <Text style={styles.hourlyWind}>
                    {Math.round(item.wind_speed * 3.6)}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Daily View */}
      {activeTab === 'daily' && (
        <View style={styles.dailyList}>
          {dailyForecasts.map((day) => {
            const Icon = getWeatherIcon(day.weather_symbol_code);
            return (
              <View key={day.date} style={styles.dailyItem}>
                <Text style={styles.dailyLabel}>{day.label}</Text>
                <Icon size={24} />
                <View style={styles.dailyTemps}>
                  <Text style={styles.dailyTempHigh}>
                    {day.tempHigh !== null ? `${Math.round(day.tempHigh)}°` : '—'}
                  </Text>
                  <Text style={styles.dailyTempLow}>
                    {day.tempLow !== null ? `${Math.round(day.tempLow)}°` : '—'}
                  </Text>
                </View>
                <View style={styles.dailyPrecip}>
                  <Text style={styles.dailyPrecipText}>
                    {day.precipitation > 0 ? `${day.precipitation} mm` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Footer: source & last updated */}
      <View style={styles.footer}>
        <Text style={styles.sourceText}>
          Quelle: {source === 'meteoswiss' ? 'MeteoSwiss' : source === 'yrno_direct' ? 'yr.no' : 'MeteoSwiss / yr.no'}
        </Text>
        {lastUpdated && (
          <Text style={styles.updatedText}>
            Zuletzt aktualisiert:{' '}
            {new Date(lastUpdated).toLocaleString('de-CH', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
            })}
          </Text>
        )}
        {source === 'yrno_direct' && (
          <Text style={styles.offlineHint}>Direkte Abfrage (kein Cache)</Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Warning
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  warningIcon: {
    fontSize: 16,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
    fontWeight: '600',
  },

  // Current
  currentWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  currentInfo: {
    flex: 1,
  },
  currentTemp: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
  },
  currentDetails: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Hourly
  hourlyList: {
    paddingVertical: 4,
    gap: 4,
  },
  hourlyItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.surfaceVariant,
    minWidth: 64,
    gap: 6,
  },
  hourlyTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  hourlyTemp: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  hourlyWind: {
    fontSize: 11,
    color: Colors.textLight,
  },

  // Daily
  dailyList: {
    gap: 2,
  },
  dailyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  dailyLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
    width: 72,
  },
  dailyTemps: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  dailyTempHigh: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  dailyTempLow: {
    fontSize: 15,
    color: Colors.textLight,
  },
  dailyPrecip: {
    width: 52,
    alignItems: 'flex-end',
  },
  dailyPrecipText: {
    fontSize: 12,
    color: Colors.info,
  },

  // Footer
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    gap: 2,
  },
  sourceText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  updatedText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  offlineHint: {
    fontSize: 11,
    color: Colors.warning,
    fontStyle: 'italic',
  },
});
