import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../constants';

interface ServiceInfo {
  name: string;
  purpose: string;
  data: string;
}

// Jeder Eintrag entspricht einer Adresse, die TrailMate im Code anspricht.
const SERVICES: ServiceInfo[] = [
  {
    name: 'Supabase (TrailMate-Server)',
    purpose: 'Konto, Daten der App und Benachrichtigungen.',
    data: 'Konto, Profil, gespeicherte Touren mit Linie, Beiträge, Fotos, Nachrichten, Push-Token; den Live-Standort nur, wenn du ihn teilst.',
  },
  {
    name: 'swisstopo (geo.admin.ch)',
    purpose: 'Karten, Wanderwege und Ortssuche.',
    data: 'Der angezeigte Kartenausschnitt und der Suchtext.',
  },
  {
    name: 'BRouter (brouter.de)',
    purpose: 'Berechnung von Routen.',
    data: 'Start, Ziel und Zwischenpunkte.',
  },
  {
    name: 'Wetter',
    purpose: 'Wettervorhersage für einen Ort.',
    data: 'Die Koordinaten des Orts. Normalerweise über den TrailMate-Server, sonst direkt an MET Norway (api.met.no).',
  },
  {
    name: 'ÖV (transport.opendata.ch)',
    purpose: 'Verbindungen und Haltestellen.',
    data: 'Die Koordinaten von Start und Ziel bzw. die Haltestellen.',
  },
  {
    name: 'unpkg.com',
    purpose: 'Lädt die Kartenbibliothek, nur in der Browser-Version.',
    data: 'Keine Daten aus der App, nur die übliche Anfrage des Browsers.',
  },
  {
    name: 'Links (sbb.ch, openstreetmap.org, maps.apple.com)',
    purpose: 'Öffnen Fahrpläne oder Karten ausserhalb der App.',
    data: 'Erst wenn du einen solchen Link selbst antippst.',
  },
];

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: true, title: 'Datenschutz' }} />
      <Text style={styles.intro}>
        Diese Übersicht zeigt, welche Dienste TrailMate nutzt und welche Daten dabei übertragen
        werden. Sie ersetzt keine Datenschutzerklärung.
      </Text>

      {SERVICES.map((service) => (
        <View key={service.name} style={styles.card}>
          <Text style={styles.name}>{service.name}</Text>
          <Text style={styles.label}>Zweck</Text>
          <Text style={styles.text}>{service.purpose}</Text>
          <Text style={styles.label}>Übertragene Daten</Text>
          <Text style={styles.text}>{service.data}</Text>
        </View>
      ))}

      <Text style={styles.section}>Aufnahme</Text>
      <View style={styles.card}>
        <Text style={styles.text}>
          Die GPS-Punkte einer laufenden Tour liegen zuerst nur auf dem Gerät und gehen erst beim
          Speichern an dein Konto. Versteckte Touren sehen andere nicht.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  intro: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
    marginBottom: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  text: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginTop: 2,
  },
  section: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
});
